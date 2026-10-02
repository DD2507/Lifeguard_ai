const test = require("node:test");
const assert = require("node:assert/strict");

const {
    resolveScheduledAt,
    processDueReminders
} = require("./prescriptionReminderScheduler");

function makeSocket() {
    const events = [];
    return {
        events,
        sockets: {
            adapter: {
                rooms: new Map([
                    ["doctor-dashboard", new Set(["doctor-socket"])]
                ])
            }
        },
        to(room) {
            return {
                emit(event, payload) {
                    events.push({ rooms: Array.isArray(room) ? room : [room], event, payload });
                }
            };
        }
    };
}

function makePrescriptionModel(records) {
    const alertRecords = [];
    const matches = (record, filter) => {
        if (!record || record._id !== filter._id || record.status !== filter.status) return false;
        if (record.scheduledAt > filter.scheduledAt.$lte) return false;
        if (record.reminderDeliveredAt) return false;
        const stale = filter.$and[0].$or[2].reminderClaimedAt.$lte;
        if (record.reminderClaimedAt && record.reminderClaimedAt > stale) return false;
        return true;
    };
    const model = {
        find() {
            return {
                sort() {
                    return this;
                },
                async limit() {
                    return records.filter((record) =>
                        record.status === "ACTIVE" &&
                        (!record.scheduledAt || record.scheduledAt <= nowForQuery)
                    );
                }
            };
        },
        async updateOne(filter, update) {
            const record = records.find((item) => item._id === filter._id);
            if (!record) return { matchedCount: 0 };
            if (update.$set && update.$set.scheduledAt && !record.scheduledAt) {
                record.scheduledAt = update.$set.scheduledAt;
            }
            if (update.$set && (!filter.reminderClaimToken || record.reminderClaimToken === filter.reminderClaimToken)) Object.assign(record, update.$set);
            if (update.$unset) Object.keys(update.$unset).forEach((key) => delete record[key]);
            return { matchedCount: 1 };
        },
        async findOneAndUpdate(filter, update) {
            const record = records.find((item) => item._id === filter._id);
            if (!matches(record, filter)) return null;
            Object.assign(record, update.$set);
            return record;
        }
    };
    model.AlertModel = {
        records: alertRecords,
        async findOne({ occurrenceId }) {
            return alertRecords.find((alert) => alert.occurrenceId === occurrenceId) || null;
        },
        async findOneAndUpdate({ occurrenceId }, update) {
            let alert = alertRecords.find((item) => item.occurrenceId === occurrenceId);
            if (!alert) {
                alert = {
                    _id: `alert:${occurrenceId}`,
                    status: "ACTIVE",
                    ...update.$setOnInsert
                };
                alertRecords.push(alert);
            }
            return alert;
        }
    };
    model.PatientModel = {
        async findOne({ patientId }) {
            return { patientId, name: `Test ${patientId}`, room: "TEST-ROOM" };
        }
    };
    return model;
}

let nowForQuery = new Date("2026-09-29T16:31:00.000Z");

test("resolves legacy 12-hour and 24-hour time-only values in India time", () => {
    const evening = resolveScheduledAt({
        startDate: "2026-09-29T00:00:00.000Z",
        scheduledTime: "10:00 PM"
    });
    const morning = resolveScheduledAt({
        startDate: "2026-09-29",
        scheduledTime: "09:05"
    });

    assert.equal(evening.toISOString(), "2026-09-29T16:30:00.000Z");
    assert.equal(morning.toISOString(), "2026-09-29T03:35:00.000Z");
});

test("preserves full datetime offsets and rejects invalid schedule values", () => {
    const fullDateTime = resolveScheduledAt({
        scheduledTime: "2026-09-29T22:00:00+05:30"
    });

    assert.equal(fullDateTime.toISOString(), "2026-09-29T16:30:00.000Z");
    assert.equal(resolveScheduledAt({ startDate: "2026-02-30", scheduledTime: "10:00 PM" }), null);
    assert.equal(resolveScheduledAt({ startDate: "2026-09-29", scheduledTime: "25:90" }), null);
});

test("future prescription does not trigger early; due prescription triggers once", async () => {
    const record = {
        _id: "prescription-1",
        patientId: "P012",
        treatmentName: "TEST scheduled reminder",
        dosage: "TEST ONLY",
        scheduledTime: "10:30 PM",
        startDate: "2026-09-29",
        status: "ACTIVE"
    };
    const records = [record];
    const model = makePrescriptionModel(records);
    const io = makeSocket();
    const dueAt = new Date("2026-09-29T17:00:00.000Z");

    nowForQuery = new Date("2026-09-29T16:59:00.000Z");
    assert.equal(await processDueReminders({ now: nowForQuery, PrescriptionModel: model, io }), 0);
    assert.equal(io.events.length, 0);

    nowForQuery = dueAt;
    assert.equal(await processDueReminders({ now: dueAt, PrescriptionModel: model, io }), 1);
    assert.ok(record.reminderDeliveredAt instanceof Date);
    assert.ok(record.reminderEmittedAt instanceof Date);
    const dueEvent = io.events.find((event) => event.event === "medicine-due");
    assert.equal(io.events.filter((event) => event.event === "medicine-due").length, 1);
    assert.equal(dueEvent.payload.patientId, "P012");
    assert.equal(dueEvent.payload.treatmentName, "TEST scheduled reminder");
    assert.ok(model.AlertModel.records[0]);
    assert.equal(model.AlertModel.records[0].alertType, "MEDICINE_DUE");
    assert.equal(model.AlertModel.records[0].patientName, "Test P012");
    assert.equal(model.AlertModel.records[0].room, "TEST-ROOM");
    assert.equal(io.events.filter((event) => event.event === "alert-created").length, 1);
    assert.deepEqual(dueEvent.rooms, [
        "doctor-dashboard",
        "nurse-dashboard",
        "patient-P012"
    ]);

    assert.equal(await processDueReminders({
        now: new Date(dueAt.getTime() + 10_000),
        PrescriptionModel: model,
        io
    }), 0);
    assert.equal(io.events.filter((event) => event.event === "medicine-due").length, 1);
    assert.equal(model.AlertModel.records.length, 1);
});

test("concurrent scheduler executions claim and emit a due reminder once", async () => {
    const dueAt = new Date("2026-09-29T17:00:00.000Z");
    const records = [{
        _id: "concurrent-prescription",
        patientId: "TEST-001",
        treatmentName: "TEST concurrent reminder",
        dosage: "TEST ONLY",
        scheduledAt: dueAt,
        scheduledTime: "10:30 PM",
        status: "ACTIVE"
    }];
    const model = makePrescriptionModel(records);
    const io = makeSocket();
    nowForQuery = dueAt;

    const delivered = await Promise.all([
        processDueReminders({ now: dueAt, PrescriptionModel: model, io }),
        processDueReminders({ now: dueAt, PrescriptionModel: model, io })
    ]);

    assert.equal(delivered.reduce((total, count) => total + count, 0), 1);
    assert.equal(io.events.filter((event) => event.event === "medicine-due").length, 1);
    assert.ok(records[0].reminderDeliveredAt instanceof Date);
});

test("processes due reminders without dashboard subscribers", async () => {
    const dueAt = new Date("2026-09-29T17:00:00.000Z");
    const record = {
        _id: "offline-dashboard-prescription",
        patientId: "TEST-002",
        treatmentName: "TEST offline dashboard reminder",
        dosage: "TEST ONLY",
        scheduledAt: dueAt,
        scheduledTime: "10:30 PM",
        status: "ACTIVE"
    };
    const model = makePrescriptionModel([record]);
    const io = makeSocket();
    io.sockets.adapter.rooms.clear();
    nowForQuery = dueAt;

    assert.equal(await processDueReminders({ now: dueAt, PrescriptionModel: model, io }), 1);
    assert.ok(record.reminderDeliveredAt instanceof Date);
    assert.equal(io.events.filter((event) => event.event === "medicine-due").length, 1);
});

test("persists a due alert while Socket.IO is unavailable without marking it delivered", async () => {
    const dueAt = new Date("2026-09-29T17:00:00.000Z");
    const record = {
        _id: "offline-socket-prescription",
        patientId: "TEST-003",
        treatmentName: "TEST offline socket reminder",
        dosage: "TEST ONLY",
        scheduledAt: dueAt,
        scheduledTime: "10:30 PM",
        status: "ACTIVE"
    };
    const model = makePrescriptionModel([record]);
    nowForQuery = dueAt;

    assert.equal(await processDueReminders({
        now: dueAt,
        PrescriptionModel: model,
        AlertModel: model.AlertModel,
        PatientModel: model.PatientModel,
        io: null
    }), 0);
    assert.equal(model.AlertModel.records.length, 1);
    assert.equal(record.reminderDeliveredAt, undefined);
    assert.equal(record.reminderClaimedAt, undefined);
});

test("does not deliver completed or cancelled prescriptions", async () => {
    const records = [
        { _id: "done", status: "COMPLETED", scheduledAt: new Date("2026-09-29T16:00:00.000Z") },
        { _id: "cancelled", status: "CANCELLED", scheduledAt: new Date("2026-09-29T16:00:00.000Z") }
    ];
    const model = makePrescriptionModel(records);
    const io = makeSocket();

    assert.equal(await processDueReminders({ now: nowForQuery, PrescriptionModel: model, io }), 0);
    assert.equal(io.events.length, 0);
});

test("supports flexible time formats including no-colon meridiem and seconds", () => {
    const tenPm = resolveScheduledAt({
        startDate: "2026-09-29",
        scheduledTime: "10 PM"
    });
    const nineAm = resolveScheduledAt({
        startDate: "2026-09-29",
        scheduledTime: "9am"
    });
    const withSeconds = resolveScheduledAt({
        startDate: "2026-09-29",
        scheduledTime: "10:30:15 PM"
    });

    assert.equal(tenPm.toISOString(), "2026-09-29T16:30:00.000Z");
    assert.equal(nineAm.toISOString(), "2026-09-29T03:30:00.000Z");
    assert.equal(withSeconds.toISOString(), "2026-09-29T17:00:15.000Z");
});

test("defaults startDate to current Asia/Kolkata date when omitted", () => {
    const resolved = resolveScheduledAt({
        scheduledTime: "10:00 PM"
    });
    assert.ok(resolved instanceof Date);
    assert.ok(!Number.isNaN(resolved.getTime()));
});

test("restarting scheduler does not resend already delivered reminders", async () => {
    const deliveredAt = new Date("2026-09-29T15:00:00.000Z");
    const records = [{
        _id: "already-delivered",
        patientId: "P999",
        treatmentName: "Delivered Med",
        dosage: "100mg",
        scheduledAt: deliveredAt,
        scheduledTime: "08:30 PM",
        reminderDeliveredAt: deliveredAt,
        status: "ACTIVE"
    }];
    const model = makePrescriptionModel(records);
    const io = makeSocket();
    nowForQuery = new Date("2026-09-29T16:00:00.000Z");

    const delivered = await processDueReminders({ now: nowForQuery, PrescriptionModel: model, io });
    assert.equal(delivered, 0);
    assert.equal(io.events.filter((event) => event.event === "medicine-due").length, 0);
    assert.equal(model.AlertModel.records.length, 1);
    assert.ok(records[0].reminderAlertId);
});

test("failed Socket.IO delivery does not mark reminder delivered and can retry", async () => {
    const dueAt = new Date("2026-09-29T17:00:00.000Z");
    const records = [{ _id: "failed-emit", patientId: "TEST", treatmentName: "Med", dosage: "1", scheduledAt: dueAt, status: "ACTIVE" }];
    const model = makePrescriptionModel(records);
    const brokenSocket = { to() { return { emit() { throw new Error("socket unavailable"); } }; } };
    nowForQuery = dueAt;

    assert.equal(await processDueReminders({ now: dueAt, PrescriptionModel: model, io: brokenSocket }), 0);
    assert.equal(records[0].reminderDeliveredAt, undefined);
    assert.equal(records[0].reminderClaimedAt, undefined);
    assert.equal(model.AlertModel.records.length, 1);

    const io = makeSocket();
    assert.equal(await processDueReminders({ now: dueAt, PrescriptionModel: model, io }), 1);
    assert.ok(records[0].reminderDeliveredAt instanceof Date);
    assert.equal(model.AlertModel.records.length, 1);
});
