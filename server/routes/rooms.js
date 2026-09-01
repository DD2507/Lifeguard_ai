const express = require("express");
const mongoose = require("mongoose");

const Room = require("../models/room");
const Patient = require("../models/Patient");
const Alert = require("../models/Alert");

const { calculateRisk } = require("../services/riskEngine");

const router = express.Router();

const fallbackRooms = [
    { roomId: "102", name: "Room 102", temperature: 32, humidity: 75, airQuality: 220, presenceDetected: true, fanStatus: true, buzzerStatus: true, patientId: "P003" },
    { roomId: "105", name: "Room 105", temperature: 24, humidity: 50, airQuality: 80, presenceDetected: true, fanStatus: false, buzzerStatus: false, patientId: "P012" },
    { roomId: "103", name: "Room 103", temperature: 26, humidity: 55, airQuality: 110, presenceDetected: true, fanStatus: false, buzzerStatus: false, patientId: "P007" },
    { roomId: "107", name: "Room 107", temperature: 23, humidity: 45, airQuality: 70, presenceDetected: true, fanStatus: false, buzzerStatus: false, patientId: "P015" }
];


// ======================================================
// GET ALL ROOMS
// ======================================================

router.get("/", async (req, res) => {
    try {
        if (mongoose.connection.readyState === 1) {
            const rooms = await Room.find().sort({ roomId: 1 });
            return res.json(rooms);
        }
        res.json(fallbackRooms);
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
        if (mongoose.connection.readyState === 1) {
            const room = await Room.findOne({
                roomId: req.params.id
            });
            if (room) return res.json(room);
        }
        const fallbackRoom = fallbackRooms.find(r => r.roomId === req.params.id);
        if (!fallbackRoom) {
            return res.status(404).json({
                error: "Room not found"
            });
        }
        res.json(fallbackRoom);
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


        // ==================================================
        // UPDATE ROOM
        // ==================================================

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


        // ==================================================
        // FIND PATIENTS IN THIS ROOM
        // ==================================================

        const patients = await Patient.find({
            room: req.params.id
        });


        const updatedPatients = [];


        // ==================================================
        // REASSESS EACH PATIENT
        // ==================================================

        for (const patient of patients) {

            const roomContext = {
                temperature: room.temperature,
                humidity: room.humidity,
                airQuality: room.airQuality,
                presenceDetected: room.presenceDetected
            };


            // Calculate combined patient + room risk
            const riskResult = calculateRisk(
                {
                    heartRate: patient.heartRate,
                    spo2: patient.spo2,
                    temperature: patient.temperature
                },
                roomContext
            );


            // ==================================================
            // UPDATE PATIENT
            // ==================================================

            patient.risk = riskResult.risk;

            patient.riskScore =
                riskResult.riskScore;

            patient.riskReasons =
                riskResult.riskReasons;

            patient.riskSummary =
                riskResult.riskSummary;

            patient.recommendedAction =
                riskResult.recommendedAction;

            patient.roomContext =
                roomContext;

            await patient.save();


            // ==================================================
            // ALERT MANAGEMENT
            // ==================================================

            if (
                riskResult.risk === "HIGH" ||
                riskResult.risk === "MODERATE"
            ) {

                const existingAlert =
                    await Alert.findOne({
                        patientId: patient.patientId,
                        status: "ACTIVE"
                    });


                // ==============================================
                // UPDATE EXISTING ALERT
                // ==============================================

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
                }


                // ==============================================
                // CREATE NEW ALERT
                // ==============================================

                else {

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

            }


            // ==================================================
            // LOW RISK → RESOLVE ALERT
            // ==================================================

            else {

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


            // ==================================================
            // RETURN UPDATED PATIENT
            // ==================================================

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


        // ==================================================
        // RESPONSE
        // ==================================================

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


module.exports = {
    router,
    fallbackRooms
};