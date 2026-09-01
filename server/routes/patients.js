const express = require("express");
const mongoose = require("mongoose");
const Patient = require("../models/Patient");
const { calculateRiskWithAI } = require("../services/riskEngine");

const router = express.Router();

const fallbackPatients = [
    {
        patientId: "P003",
        name: "Patient 003",
        room: "102",
        heartRate: 108,
        spo2: 92,
        temperature: 38.2,
        roomContext: { temperature: 32, humidity: 75, airQuality: 220, presenceDetected: true }
    },
    {
        patientId: "P012",
        name: "Patient 012",
        room: "105",
        heartRate: 82,
        spo2: 97,
        temperature: 36.8,
        roomContext: { temperature: 24, humidity: 50, airQuality: 80, presenceDetected: true }
    },
    {
        patientId: "P007",
        name: "Patient 007",
        room: "103",
        heartRate: 96,
        spo2: 95,
        temperature: 37.4,
        roomContext: { temperature: 26, humidity: 55, airQuality: 110, presenceDetected: true }
    },
    {
        patientId: "P015",
        name: "Patient 015",
        room: "107",
        heartRate: 76,
        spo2: 98,
        temperature: 36.6,
        roomContext: { temperature: 23, humidity: 45, airQuality: 70, presenceDetected: true }
    }
];


// GET ALL PATIENTS
router.get("/", async (req, res) => {
    try {
        let patientsData;
        if (mongoose.connection.readyState === 1) {
            const dbPatients = await Patient.find();
            patientsData = dbPatients.map(p => p.toObject());
        } else {
            patientsData = fallbackPatients;
        }

        const patientsWithRisk = await Promise.all(patientsData.map(async (patientData) => {
            const roomContext = patientData.roomContext || {};

            const riskResult = await calculateRiskWithAI(
                {
                    heartRate: patientData.heartRate,
                    spo2: patientData.spo2,
                    temperature: patientData.temperature
                },
                roomContext
            );

            return {
                ...patientData,
                ...riskResult
            };
        }));

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
        let patientData;
        if (mongoose.connection.readyState === 1) {
            const patient = await Patient.findOne({
                patientId: req.params.id
            });
            if (patient) patientData = patient.toObject();
        } else {
            patientData = fallbackPatients.find(p => p.patientId === req.params.id);
        }

        if (!patientData) {
            return res.status(404).json({
                error: "Patient not found"
            });
        }

        const roomContext = patientData.roomContext || {};

        const riskResult = await calculateRiskWithAI(
            {
                heartRate: patientData.heartRate,
                spo2: patientData.spo2,
                temperature: patientData.temperature
            },
            roomContext
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