const express = require("express");

const Patient = require("../models/Patient");

const {
    resetBaseline
} = require("../services/baselineService");

const router = express.Router();

// CREATE PATIENT
router.post("/", async (req, res) => {
    try {
        const {
            patientId,
            name,
            room
        } = req.body;

        if (
            !patientId ||
            !name ||
            !room
        ) {
            return res.status(400).json({
                error:
                    "patientId, name and room are required"
            });
        }

        const existingPatient =
            await Patient.findOne({
                patientId
            });

        if (existingPatient) {
            return res.status(409).json({
                error: "Patient already exists"
            });
        }

        const patient =
            await Patient.create({
                patientId,
                name,
                room
            });

        res.status(201).json(patient);

    } catch (error) {
        console.error(
            "Failed to create patient:",
            error
        );

        res.status(500).json({
            error: "Failed to create patient"
        });
    }
});

// RESET PATIENT BASELINE
router.post("/:id/baseline/reset", async (req, res) => {
    try {
        const patient = await Patient.findOne({
            patientId: req.params.id
        });

        if (!patient) {
            return res.status(404).json({
                error: "Patient not found"
            });
        }

        resetBaseline(patient.patientId);

        patient.baseline = {
            heartRate: null,
            spo2: null,
            temperature: null,
            sampleCount: 0,
            established: false
        };

        patient.heartRate = null;
        patient.spo2 = null;
        patient.temperature = null;

        patient.risk = "LOW";
        patient.riskScore = 0;
        patient.riskReasons = [];
        patient.riskSummary = "";

        patient.recommendedAction = {
            fan: false,
            buzzer: false,
            reason: ""
        };

        patient.baselineDeviation = {
            heartRate: null,
            spo2: null,
            temperature: null
        };

        await patient.save();

        res.json({
            message: "Patient baseline reset successfully",
            patientId: patient.patientId,
            baseline: patient.baseline,
            baselineDeviation: patient.baselineDeviation
        });

    } catch (error) {
        console.error(
            "Failed to reset patient baseline:",
            error
        );

        res.status(500).json({
            error: "Failed to reset patient baseline"
        });
    }
});

// GET ALL PATIENTS
router.get("/", async (req, res) => {
    try {
        const patients = await Patient.find();

        const patientsWithStatus = patients.map((patient) => {
            const patientData = patient.toObject();

            if (!patientData.baseline?.established) {
                return {
                    ...patientData,
                    risk: "LOW",
                    riskScore: 0,
                    riskReasons: [],
                    riskSummary:
                        "Baseline is currently being established.",
                    recommendedAction: {
                        fan: false,
                        buzzer: false,
                        reason:
                            "Baseline collection in progress."
                    }
                };
            }

            return patientData;
        });

        res.json(patientsWithStatus);

    } catch (error) {
        console.error(
            "Failed to fetch patients:",
            error
        );

        res.status(500).json({
            error: "Failed to fetch patients"
        });
    }
});

// GET SINGLE PATIENT
router.get("/:id", async (req, res) => {
    try {
        const patient = await Patient.findOne({
            patientId: req.params.id
        });

        if (!patient) {
            return res.status(404).json({
                error: "Patient not found"
            });
        }

        const patientData = patient.toObject();

        if (!patientData.baseline?.established) {
            return res.json({
                ...patientData,
                risk: "LOW",
                riskScore: 0,
                riskReasons: [],
                riskSummary:
                    "Baseline is currently being established.",
                recommendedAction: {
                    fan: false,
                    buzzer: false,
                    reason:
                        "Baseline collection in progress."
                }
            });
        }

        res.json(patientData);

    } catch (error) {
        console.error(
            "Failed to fetch patient:",
            error
        );

        res.status(500).json({
            error: "Failed to fetch patient"
        });
    }
});

module.exports = router;