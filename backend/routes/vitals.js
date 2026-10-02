const express = require("express");


const Vital = require("../models/Vital");
const {
    processPatientVital
} = require("../services/patientVitalService");

const router = express.Router();

// ======================================================
// UPDATE PATIENT VITALS
// ======================================================

router.post("/:patientId", async (req, res) => {
    try {
        const { patientId } = req.params;

        const result =
            await processPatientVital(
                patientId,
                req.body,
                { source: "API" }
            );

        if (result.ignored) {
            return res.status(202).json({
                message: "HTTP-submitted readings are not accepted as live IoT data",
                baselineStatus: result.baselineStatus,
                sensorStatus: result.sensorStatus
            });
        }

        res.status(202).json({
            message: "HTTP-submitted readings are not accepted as live IoT data",
            baselineStatus: result.baselineStatus,
            sensorStatus: result.sensorStatus
        });

    } catch (error) {
        console.error(
            "Failed to process patient vitals:",
            error
        );

        const status =
            error.message ===
            "Patient not found"
                ? 404
                : 400;

        res.status(status).json({
            error: error.message
        });
    }
});

// ======================================================
// GET PATIENT VITAL HISTORY
// ======================================================

router.get("/:patientId/history", async (req, res) => {
    try {

        const vitals =
            await Vital.find({
                patientId: req.params.patientId,
                source: "MQTT"
            })
                .sort({
                    createdAt: -1
                })
                .limit(100);

        res.json(vitals);

    } catch (error) {

        console.error(
            "Failed to fetch vital history:",
            error
        );

        res.status(500).json({
            error:
                "Failed to fetch vital history"
        });
    }
});

module.exports = router;