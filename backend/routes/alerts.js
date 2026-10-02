const express = require("express");

const Alert = require("../models/Alert");
const { completeMedicineDose } = require("../services/prescriptionCompletionService");
const { getNotificationSocket, notifyAlertCreated, notifyAlertResolved } = require("../services/notificationService");
const { publishHighRiskDemoStop } = require("../services/mqttBroker");

const router = express.Router();

// ======================================================
// GET ALL ACTIVE ALERTS
// ======================================================

router.get("/", async (req, res) => {
    try {
        const alerts = await Alert.find({
            status: { $in: ["ACTIVE", "ACKNOWLEDGED"] }
        }).sort({
            createdAt: -1
        });

        res.json(alerts);

    } catch (error) {

        console.error(
            "Failed to fetch alerts:",
            error
        );

        res.status(500).json({
            error: "Failed to fetch alerts"
        });
    }
});

// ======================================================
// GET ALL ALERT HISTORY
// ======================================================

router.get("/history", async (req, res) => {
    try {

        const alerts = await Alert.find()
            .sort({
                createdAt: -1
            })
            .limit(100);

        res.json(alerts);

    } catch (error) {

        console.error(
            "Failed to fetch alert history:",
            error
        );

        res.status(500).json({
            error: "Failed to fetch alert history"
        });
    }
});

// ======================================================
// GET ALERTS FOR ONE PATIENT
// ======================================================

router.get("/patient/:patientId", async (req, res) => {
    try {

        const alerts = await Alert.find({
            patientId:
                req.params.patientId
        }).sort({
            createdAt: -1
        });

        res.json(alerts);

    } catch (error) {

        console.error(
            "Failed to fetch patient alerts:",
            error
        );

        res.status(500).json({
            error: "Failed to fetch patient alerts"
        });
    }
});

// ======================================================
// RESOLVE AN ALERT
// ======================================================

router.patch("/:id/resolve", async (req, res) => {
    try {

        const existing = await Alert.findById(req.params.id);
        if (existing?.alertType === "MEDICINE_DUE") {
            const completion = await completeMedicineDose({
                alertId: String(existing._id),
                completedBy: req.body?.completedBy || "Clinical staff"
            });
            if (!completion) {
                return res.status(404).json({ error: "Medicine reminder or prescription not found" });
            }
            return res.json({
                message: "Medicine dose marked as completed",
                alert: completion.alert,
                prescription: completion.prescription
            });
        }

        const alert =
            await Alert.findOneAndUpdate(
                { _id: req.params.id, alertType: { $ne: "MEDICINE_DUE" } },
                {
                    status: "RESOLVED",
                    resolvedAt: new Date()
                },
                {
                    new: true
                }
            );

        if (!alert) {
            return res.status(404).json({
                error: "Alert not found"
            });
        }

        const io = getNotificationSocket();
        if (io) {
            notifyAlertResolved(io, alert.patientId, alert._id);
        }

        // A running demo script is the only consumer of this command. Normal
        // patient alerts keep their existing resolve behavior when no demo is active.
        if (alert.alertType === "PATIENT_RISK") {
            await publishHighRiskDemoStop(alert.patientId);
        }

        res.json({
            message:
                "Alert resolved successfully",

            alert
        });

    } catch (error) {

        console.error(
            "Failed to resolve alert:",
            error
        );

        res.status(500).json({
            error:
                "Failed to resolve alert"
        });
    }
});

module.exports = router;
