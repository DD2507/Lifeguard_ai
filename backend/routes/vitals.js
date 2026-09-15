const express = require("express");

const Patient = require("../models/Patient");
const Vital = require("../models/Vital");
const Room = require("../models/room");
const Alert = require("../models/Alert");

const { calculateRisk } = require("../services/riskEngine");

const {
    BASELINE_SAMPLE_COUNT,
    addSample,
    calculateBaseline,
    calculateDeviation
} = require("../services/baselineService");

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
                req.body
            );

        if (
            result.baselineStatus ===
            "COLLECTING"
        ) {
            return res.json({
                message:
                    "Baseline collection in progress",

                baseline:
                    result.baseline,

                patient: {
                    patientId:
                        result.patient.patientId,

                    name:
                        result.patient.name,

                    room:
                        result.patient.room,

                    heartRate:
                        result.patient.heartRate,

                    spo2:
                        result.patient.spo2,

                    temperature:
                        result.patient.temperature
                }
            });
        }

        if (
            result.baselineStatus ===
            "ESTABLISHED" &&
            !result.risk
        ) {
            return res.json({
                message:
                    "Baseline established",

                baseline:
                    result.baseline,

                baselineDeviation:
                    result.baselineDeviation,

                patient: {
                    patientId:
                        result.patient.patientId,

                    name:
                        result.patient.name,

                    room:
                        result.patient.room,

                    heartRate:
                        result.patient.heartRate,

                    spo2:
                        result.patient.spo2,

                    temperature:
                        result.patient.temperature
                }
            });
        }

        res.json({
            message:
                "Patient vitals processed successfully",

            patient: {
                patientId:
                    result.patient.patientId,

                name:
                    result.patient.name,

                room:
                    result.patient.room,

                heartRate:
                    result.patient.heartRate,

                spo2:
                    result.patient.spo2,

                temperature:
                    result.patient.temperature,

                baseline:
                    result.patient.baseline,

                baselineDeviation:
                    result.baselineDeviation,

                risk:
                    result.risk.risk,

                riskScore:
                    result.risk.riskScore,

                riskReasons:
                    result.risk.riskReasons,

                riskSummary:
                    result.risk.riskSummary,

                recommendedAction:
                    result.risk.recommendedAction,

                roomContext:
                    result.patient.roomContext
            },

            history: {
                id:
                    result.vital._id,

                timestamp:
                    result.vital.createdAt
            }
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
                patientId:
                    req.params.patientId
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