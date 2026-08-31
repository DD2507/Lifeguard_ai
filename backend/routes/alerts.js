const express = require("express");

const Alert = require("../models/Alert");

const router = express.Router();

// ======================================================
// GET ALL ACTIVE ALERTS
// ======================================================

router.get("/", async (req, res) => {
    try {
        const alerts = await Alert.find({
            status: "ACTIVE"
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

        const alert =
            await Alert.findByIdAndUpdate(
                req.params.id,
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