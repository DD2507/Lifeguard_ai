const express = require("express");

const Room = require("../models/room");
const Patient = require("../models/Patient");
const Alert = require("../models/Alert");

const { calculateRisk } = require("../services/riskEngine");

const router = express.Router();

// ======================================================
// GET ALL ROOMS
// ======================================================

router.get("/", async (req, res) => {
    try {
        const rooms = await Room.find().sort({ roomId: 1 });

        res.json(rooms);

    } catch (error) {
        console.error("Failed to fetch rooms:", error);

        res.status(500).json({
            error: "Failed to fetch rooms"
        });
    }
});

// ======================================================
// GET SINGLE ROOM
// ======================================================

router.get("/:id", async (req, res) => {
    try {
        const room = await Room.findOne({
            roomId: req.params.id
        });

        if (!room) {
            return res.status(404).json({
                error: "Room not found"
            });
        }

        res.json(room);

    } catch (error) {
        console.error("Failed to fetch room:", error);

        res.status(500).json({
            error: "Failed to fetch room"
        });
    }
});

// ======================================================
// UPDATE ROOM SENSOR DATA
// ======================================================

router.post("/:id/environment", async (req, res) => {
    try {
        const {
            temperature,
            humidity,
            airQuality,
            presenceDetected
        } = req.body;

        const room = await Room.findOneAndUpdate(
            {
                roomId: req.params.id
            },
            {
                temperature,
                humidity,
                airQuality,
                presenceDetected,
                lastUpdated: new Date()
            },
            {
                new: true,
                upsert: true,
                runValidators: true
            }
        );

        const patients = await Patient.find({
            room: req.params.id
        });

        const updatedPatients = [];

        for (const patient of patients) {

            const roomContext = {
                temperature: room.temperature,
                humidity: room.humidity,
                airQuality: room.airQuality,
                presenceDetected: room.presenceDetected
            };

            const riskResult = calculateRisk(
                {
                    heartRate: patient.heartRate,
                    spo2: patient.spo2,
                    temperature: patient.temperature
                },
                roomContext
            );

            // Update patient risk
            patient.risk = riskResult.risk;
            patient.riskScore = riskResult.riskScore;
            patient.riskReasons = riskResult.riskReasons;
            patient.riskSummary = riskResult.riskSummary;
            patient.recommendedAction =
                riskResult.recommendedAction;
            patient.roomContext = roomContext;

            await patient.save();

            // ==================================================
            // ALERT MANAGEMENT
            // ==================================================

            if (
                riskResult.risk === "HIGH" ||
                riskResult.risk === "MODERATE"
            ) {

                const existingAlert = await Alert.findOne({
                    patientId: patient.patientId,
                    status: "ACTIVE"
                });

                if (existingAlert) {

                    existingAlert.risk =
                        riskResult.risk;

                    existingAlert.riskScore =
                        riskResult.riskScore;

                    existingAlert.reasons =
                        riskResult.riskReasons;

                    existingAlert.summary =
                        riskResult.riskSummary;

                    existingAlert.recommendedAction =
                        riskResult.recommendedAction;

                    existingAlert.room =
                        patient.room;

                    await existingAlert.save();

                } else {

                    await Alert.create({

                        patientId:
                            patient.patientId,

                        patientName:
                            patient.name,

                        room:
                            patient.room,

                        risk:
                            riskResult.risk,

                        riskScore:
                            riskResult.riskScore,

                        reasons:
                            riskResult.riskReasons,

                        summary:
                            riskResult.riskSummary,

                        recommendedAction:
                            riskResult.recommendedAction,

                        status: "ACTIVE"
                    });
                }

            } else {

                // LOW RISK → RESOLVE ALERT

                await Alert.updateMany(
                    {
                        patientId:
                            patient.patientId,

                        status: "ACTIVE"
                    },
                    {
                        status: "RESOLVED",

                        resolvedAt:
                            new Date()
                    }
                );
            }

            updatedPatients.push({
                patientId:
                    patient.patientId,

                name:
                    patient.name,

                risk:
                    patient.risk,

                riskScore:
                    patient.riskScore,

                riskReasons:
                    patient.riskReasons,

                riskSummary:
                    patient.riskSummary,

                recommendedAction:
                    patient.recommendedAction
            });
        }

        res.json({

            message:
                "Room environment updated successfully",

            room,

            affectedPatients:
                updatedPatients
        });

    } catch (error) {

        console.error(
            "Failed to update room environment:",
            error
        );

        res.status(500).json({
            error:
                "Failed to update room environment"
        });
    }
});

// ======================================================
// CONTROL ROOM ACTUATORS
// ======================================================

router.post("/:id/control", async (req, res) => {
    try {

        const {
            fan,
            buzzer
        } = req.body;

        const room = await Room.findOneAndUpdate(
            {
                roomId: req.params.id
            },
            {
                fanStatus: fan,
                buzzerStatus: buzzer,
                lastUpdated: new Date()
            },
            {
                new: true,
                upsert: true,
                runValidators: true
            }
        );

        res.json({

            message:
                "Room control updated successfully",

            room
        });

    } catch (error) {

        console.error(
            "Failed to control room:",
            error
        );

        res.status(500).json({
            error:
                "Failed to control room"
        });
    }
});

module.exports = router;