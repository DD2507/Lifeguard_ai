const Prescription = require("../models/Prescription");
const Alert = require("../models/Alert");
const { getNotificationSocket, notifyAlertCompleted } = require("./notificationService");

async function completeMedicineDose({ alertId, prescriptionId, completedBy = "Clinical staff" }) {
    const alertFilter = {
        alertType: "MEDICINE_DUE",
        status: { $in: ["ACTIVE", "ACKNOWLEDGED", "COMPLETED"] }
    };
    if (alertId) alertFilter._id = alertId;
    if (prescriptionId) alertFilter.prescriptionId = String(prescriptionId);

    const matchingAlerts = await Alert.find(alertFilter).sort({ scheduledAt: 1 });
    if (alertId && matchingAlerts.length === 0) return null;

    const resolvedPrescriptionId = prescriptionId || matchingAlerts[0]?.prescriptionId;
    if (!resolvedPrescriptionId) return null;

    const prescription = await Prescription.findByIdAndUpdate(
        resolvedPrescriptionId,
        {
            $set: { status: "COMPLETED" },
            $unset: { reminderClaimedAt: 1, reminderClaimToken: 1 }
        },
        { new: true }
    );
    if (!prescription) return null;

    const completedAt = new Date();
    const completedAlerts = [];
    for (const alert of matchingAlerts) {
        const updated = await Alert.findOneAndUpdate(
            {
                _id: alert._id,
                occurrenceId: alert.occurrenceId,
                alertType: "MEDICINE_DUE",
                status: { $in: ["ACTIVE", "ACKNOWLEDGED"] },
                medicineStatus: { $ne: "COMPLETED" }
            },
            {
                $set: {
                    status: "COMPLETED",
                    medicineStatus: "COMPLETED",
                    completedAt,
                    resolvedAt: completedAt,
                    completedBy
                }
            },
            { new: true }
        );
        if (updated) completedAlerts.push(updated);
    }

    const io = getNotificationSocket();
    if (io) completedAlerts.forEach((alert) => notifyAlertCompleted(io, alert));

    const alert = alertId
        ? await Alert.findById(alertId)
        : completedAlerts[0] || matchingAlerts[0] || null;

    return { prescription, alert, completedAlerts };
}

module.exports = { completeMedicineDose };
