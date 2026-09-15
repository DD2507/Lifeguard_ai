const express = require("express");

const Patient = require("../models/Patient");

const { calculateRisk } = require("../services/riskEngine");

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

// GET ALL PATIENTS
router.get("/", async (req, res) => {
    try {
        const patients = await Patient.find();

        const patientsWithRisk = patients.map((patient) => {
            const patientData = patient.toObject();

            const roomContext = patientData.roomContext || {};

            const riskResult = calculateRisk(
            {
                    heartRate: patientData.heartRate,
                    spo2: patientData.spo2,
                    temperature: patientData.temperature
            },
                    roomContext,
                     patientData.baselineDeviation || {}
);

            return {
                ...patientData,
                ...riskResult
            };
        });

        res.json(patientsWithRisk);

    } catch (error) {
        console.error("Failed to fetch patients:", error);

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

        const roomContext = patientData.roomContext || {};

        const riskResult = calculateRisk(
    {
        heartRate: patientData.heartRate,
        spo2: patientData.spo2,
        temperature: patientData.temperature
    },
    roomContext,
    patientData.baselineDeviation || {}
);

        res.json({
            ...patientData,
            ...riskResult
        });

    } catch (error) {
        console.error("Failed to fetch patient:", error);

        res.status(500).json({
            error: "Failed to fetch patient"
        });
    }
});

module.exports = router;