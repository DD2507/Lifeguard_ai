const Prescription = require("../models/Prescription");
const Alert = require("../models/Alert");
const Patient = require("../models/Patient");
const {
    getNotificationSocket,
    notifyMedicineDue,
    notifyAlertCreated
} = require("./notificationService");
const { randomUUID } = require("node:crypto");

const INDIA_TIME_ZONE = "Asia/Kolkata";
const INDIA_OFFSET_MINUTES = 330;
const CLAIM_TIMEOUT_MS = 2 * 60 * 1000;

function parseTimeParts(value) {
    const time = String(value || "").trim();
    const twelveHour = time.match(/^(\d{1,2})(?::(\d{2}))?(?::(\d{2}))?\s*(AM|PM)$/i);
    const twentyFourHour = time.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
    const match = twelveHour || twentyFourHour;
    if (!match) return null;

    let hour = Number(match[1]);
    const minute = match[2] !== undefined ? Number(match[2]) : 0;
    const second = match[3] !== undefined ? Number(match[3]) : 0;
    if (minute > 59 || second > 59) return null;

    if (twelveHour) {
        const meridiem = match[4].toUpperCase();
        if (hour < 1 || hour > 12) return null;
        if (meridiem === "PM" && hour !== 12) hour += 12;
        if (meridiem === "AM" && hour === 12) hour = 0;
    } else if (hour > 23) {
        return null;
    }

    return { hour, minute, second };
}

function getIndiaDateParts(date = new Date()) {
    const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: INDIA_TIME_ZONE,
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
    }).formatToParts(date);
    const map = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
    return {
        year: Number(map.year),
        month: Number(map.month),
        day: Number(map.day)
    };
}

function parseDateParts(value) {
    if (!value) return getIndiaDateParts(new Date());

    if (value instanceof Date) {
        if (Number.isNaN(value.getTime())) return null;
        return getIndiaDateParts(value);
    }

    const str = String(value).trim();
    const match = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!match) return null;
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const check = new Date(Date.UTC(year, month - 1, day));
    if (
        check.getUTCFullYear() !== year ||
        check.getUTCMonth() !== month - 1 ||
        check.getUTCDate() !== day
    ) {
        return null;
    }
    return { year, month, day };
}

function resolveScheduledAt(prescription) {
    if (!prescription) return null;

    if (prescription.scheduledAt) {
        const scheduledAt = new Date(prescription.scheduledAt);
        return Number.isNaN(scheduledAt.getTime()) ? null : scheduledAt;
    }

    const legacyDateTime = String(prescription.scheduledTime || "").trim();
    if (!legacyDateTime) return null;

    const fullDateTime = legacyDateTime.match(
        /^(\d{4}-\d{2}-\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?(.*)$/
    );
    if (fullDateTime) {
        const suffix = fullDateTime[5].trim();
        if (/^(Z|[+-]\d{2}:?\d{2})$/i.test(suffix)) {
            const parsed = new Date(legacyDateTime);
            return Number.isNaN(parsed.getTime()) ? null : parsed;
        }
        const date = parseDateParts(fullDateTime[1]);
        const hour = Number(fullDateTime[2]);
        const minute = Number(fullDateTime[3]);
        const second = fullDateTime[4] ? Number(fullDateTime[4]) : 0;
        if (!date || hour > 23 || minute > 59 || second > 59) return null;
        return new Date(
            Date.UTC(date.year, date.month - 1, date.day, hour, minute, second) -
                INDIA_OFFSET_MINUTES * 60_000
        );
    }

    const date = parseDateParts(prescription.startDate);
    const time = parseTimeParts(legacyDateTime);
    if (!date || !time) return null;

    return new Date(
        Date.UTC(date.year, date.month - 1, date.day, time.hour, time.minute, time.second || 0) -
            INDIA_OFFSET_MINUTES * 60_000
    );
}

function buildDuePayload(prescription, scheduledAt) {
    const id = String(prescription._id);
    return {
        _id: id,
        occurrenceId: `${id}:${scheduledAt.toISOString()}`,
        patientId: prescription.patientId,
        treatmentName: prescription.treatmentName,
        dosage: prescription.dosage,
        scheduledTime: prescription.scheduledTime,
        scheduledAt: scheduledAt.toISOString(),
        dueTime: scheduledAt.toLocaleString("en-IN", {
            timeZone: INDIA_TIME_ZONE,
            dateStyle: "medium",
            timeStyle: "short"
        }),
        timeZone: INDIA_TIME_ZONE,
        status: prescription.status
    };
}

async function ensurePersistentMedicineAlert({
    prescription,
    scheduledAt,
    AlertModel,
    PatientModel
}) {
    const occurrenceId = `${String(prescription._id)}:${scheduledAt.toISOString()}`;
    const existing = await AlertModel.findOne({ occurrenceId });
    if (existing) return { alert: existing, created: false };

    const patient = await PatientModel.findOne({ patientId: prescription.patientId });
    const patientData = patient?.toObject ? patient.toObject() : patient;
    const alert = await AlertModel.findOneAndUpdate(
        { occurrenceId },
        {
            $setOnInsert: {
                alertType: "MEDICINE_DUE",
                occurrenceId,
                prescriptionId: String(prescription._id),
                patientId: prescription.patientId,
                patientName: patientData?.name || prescription.patientId,
                room: patientData?.room || "Unknown",
                treatmentName: prescription.treatmentName,
                dosage: prescription.dosage,
                instructions: prescription.instructions || "",
                scheduledAt,
                dueTime: scheduledAt.toLocaleString("en-IN", {
                    timeZone: INDIA_TIME_ZONE,
                    dateStyle: "medium",
                    timeStyle: "short"
                }),
                timeZone: INDIA_TIME_ZONE,
                medicineStatus: "MEDICINE_DUE",
                risk: undefined,
                riskScore: undefined,
                reasons: [],
                summary: `Medicine due: ${prescription.treatmentName} (${prescription.dosage})`
            }
        },
        { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
    );
    return { alert, created: true };
}

async function processDueReminders({
    now = new Date(),
    PrescriptionModel = Prescription,
    AlertModel = PrescriptionModel.AlertModel || Alert,
    PatientModel = PrescriptionModel.PatientModel || Patient,
    io = getNotificationSocket(),
    batchSize = 200
} = {}) {
    const candidates = await PrescriptionModel.find({
        status: "ACTIVE",
        $and: [
            {
                $or: [
                    { reminderDeliveredAt: { $exists: false } },
                    { reminderDeliveredAt: null },
                    { reminderAlertId: { $exists: false } },
                    { reminderAlertId: null }
                ]
            },
            {
                $or: [
                    { scheduledAt: { $lte: now } },
                    { scheduledAt: { $exists: false } },
                    { scheduledAt: null }
                ]
            }
        ]
    }).sort({ scheduledAt: 1 }).limit(batchSize);

    let delivered = 0;
    for (const prescription of candidates) {
        const scheduledAt = resolveScheduledAt(prescription);
        if (!scheduledAt) continue;

        if (!prescription.scheduledAt) {
            await PrescriptionModel.updateOne(
                {
                    _id: prescription._id,
                    $or: [
                        { scheduledAt: { $exists: false } },
                        { scheduledAt: null }
                    ]
                },
                { $set: { scheduledAt } }
            );
        }

        if (scheduledAt.getTime() > now.getTime()) continue;

        // Backfill an alert for reminders delivered by earlier scheduler runs.
        // The unique occurrence key prevents duplicate records after restart.
        if (prescription.reminderDeliveredAt) {
            try {
                const { alert, created } = await ensurePersistentMedicineAlert({
                    prescription,
                    scheduledAt,
                    AlertModel,
                    PatientModel
                });
                await PrescriptionModel.updateOne(
                    { _id: prescription._id, status: "ACTIVE" },
                    { $set: { reminderAlertId: String(alert._id) } }
                );
                if (created && io) notifyAlertCreated(io, alert);
            } catch (error) {
                console.error("Medicine due alert persistence failed:", error.message);
            }
            continue;
        }

        const claimToken = randomUUID();
        const staleClaimBefore = new Date(now.getTime() - CLAIM_TIMEOUT_MS);
        const claimed = await PrescriptionModel.findOneAndUpdate(
            {
                _id: prescription._id,
                status: "ACTIVE",
                scheduledAt: { $lte: now },
                $or: [
                    { reminderDeliveredAt: { $exists: false } },
                    { reminderDeliveredAt: null }
                ],
                $and: [
                    {
                        $or: [
                            { reminderClaimedAt: { $exists: false } },
                            { reminderClaimedAt: null },
                            { reminderClaimedAt: { $lte: staleClaimBefore } }
                        ]
                    }
                ]
            },
            { $set: { reminderClaimedAt: now, reminderClaimToken: claimToken } },
            { returnDocument: "after" }
        );

        if (!claimed) continue;
        let persistentAlert;
        try {
            const result = await ensurePersistentMedicineAlert({
                prescription: claimed,
                scheduledAt,
                AlertModel,
                PatientModel
            });
            persistentAlert = result.alert;
            const linked = await PrescriptionModel.updateOne(
                {
                    _id: claimed._id,
                    reminderClaimToken: claimToken,
                    status: "ACTIVE"
                },
                { $set: { reminderAlertId: String(persistentAlert._id) } }
            );
            if (linked && linked.matchedCount === 0) continue;
            if (!io) {
                await PrescriptionModel.updateOne(
                    { _id: claimed._id, reminderClaimToken: claimToken },
                    { $unset: { reminderClaimedAt: 1, reminderClaimToken: 1 } }
                );
                continue;
            }
            if (result.created) notifyAlertCreated(io, persistentAlert);
            const payload = {
                ...buildDuePayload(claimed, scheduledAt),
                alertId: String(persistentAlert._id),
                patientName: persistentAlert.patientName,
                room: persistentAlert.room,
                instructions: persistentAlert.instructions || "",
                alertType: "MEDICINE_DUE",
                medicineStatus: persistentAlert.medicineStatus || "MEDICINE_DUE"
            };
            notifyMedicineDue(io, payload);
        } catch (error) {
            // Leave the occurrence eligible for retry; never persist delivered on a failed emit.
            await PrescriptionModel.updateOne(
                { _id: claimed._id, reminderClaimToken: claimToken },
                { $unset: { reminderClaimedAt: 1, reminderClaimToken: 1 } }
            );
            console.error("Medicine due persistence or Socket.IO emission failed:", error.message);
            continue;
        }

        const emittedAt = new Date();
        const emitted = await PrescriptionModel.updateOne(
            { _id: claimed._id, reminderClaimToken: claimToken, status: "ACTIVE" },
            { $set: { reminderEmittedAt: emittedAt } }
        );
        if (emitted && emitted.matchedCount === 0) continue;

        const recorded = await PrescriptionModel.updateOne(
            { _id: claimed._id, reminderClaimToken: claimToken, status: "ACTIVE" },
            {
                $set: { reminderDeliveredAt: emittedAt },
                $unset: { reminderClaimedAt: 1, reminderClaimToken: 1 }
            }
        );
        if (recorded && recorded.matchedCount === 0) continue;
        console.log(`[Scheduler] Emitted medicine-due reminder for patient ${claimed.patientId}: ${claimed.treatmentName} (${claimed.dosage}) due at ${scheduledAt.toISOString()}`);
        delivered += 1;
    }

    return delivered;
}

let activeSchedulerTimer = null;

function startPrescriptionReminderScheduler({ intervalMs = 5_000 } = {}) {
    if (activeSchedulerTimer) {
        clearInterval(activeSchedulerTimer);
        activeSchedulerTimer = null;
    }

    let inFlight = false;

    const run = async () => {
        if (inFlight) return;
        inFlight = true;
        try {
            await processDueReminders();
        } catch (error) {
            console.error("Prescription reminder check failed:", error.message);
        } finally {
            inFlight = false;
        }
    };

    void run();
    activeSchedulerTimer = setInterval(run, intervalMs);
    return () => {
        if (activeSchedulerTimer) {
            clearInterval(activeSchedulerTimer);
            activeSchedulerTimer = null;
        }
    };
}

module.exports = {
    INDIA_TIME_ZONE,
    resolveScheduledAt,
    processDueReminders,
    startPrescriptionReminderScheduler
};
