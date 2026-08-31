const express = require("express");

const Patient = require("../models/Patient");
const Vital = require("../models/Vital");
const Room = require("../models/room");
const Alert = require("../models/Alert");

const { calculateRisk } = require("../services/riskEngine");

const router = express.Router();


// ======================================================
// UPDATE PATIENT VITALS
// ======================================================

router.post("/:patientId", async (req, res) => {
    try {
        const { patientId } = req.params;

        const {
            heartRate,
            spo2,
            temperature
        } = req.body;


        // ==================================================
        // VALIDATE INCOMING DATA
        // ==================================================

        if (
            heartRate === undefined ||
            spo2 === undefined ||
            temperature === undefined
        ) {
            return res.status(400).json({
                error: "heartRate, spo2 and temperature are required"
            });
        }


        // ==================================================
        // FIND PATIENT
        // ==================================================

        const patient = await Patient.findOne({
            patientId
        });

        if (!patient) {
            return res.status(404).json({
                error: "Patient not found"
            });
        }


        // ==================================================
        // FIND PATIENT'S ROOM
        // ==================================================

        const room = await Room.findOne({
            roomId: patient.room
        });

        const roomContext = room
            ? {
                temperature: room.temperature,
                humidity: room.humidity,
                airQuality: room.airQuality,
                presenceDetected: room.presenceDetected
            }
            : {};


        // ==================================================
        // CALCULATE RISK
        // ==================================================

        const riskResult = calculateRisk(
            {
                heartRate,
                spo2,
                temperature
            },
            roomContext
        );


        // ==================================================
        // UPDATE CURRENT PATIENT DATA
        // ==================================================

        patient.heartRate = heartRate;
        patient.spo2 = spo2;
        patient.temperature = temperature;

        patient.risk = riskResult.risk;
        patient.riskScore = riskResult.riskScore;

        patient.riskReasons = riskResult.riskReasons;
        patient.riskSummary = riskResult.riskSummary;

        patient.recommendedAction =
            riskResult.recommendedAction;

        patient.roomContext = roomContext;

        await patient.save();


        // ==================================================
        // SAVE VITAL HISTORY
        // ==================================================

        const vital = await Vital.create({
            patientId: patient.patientId,
            room: patient.room,

            heartRate,
            spo2,
            temperature,

            risk: riskResult.risk,
            riskScore: riskResult.riskScore,

            riskReasons: riskResult.riskReasons,
            riskSummary: riskResult.riskSummary,

            recommendedAction:
                riskResult.recommendedAction
        });


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
        // LOW RISK → RESOLVE OLD ALERT
        // ==================================================

        else {

            await Alert.updateMany(
                {
                    patientId: patient.patientId,
                    status: "ACTIVE"
                },
                {
                    status: "RESOLVED",
                    resolvedAt: new Date()
                }
            );
        }


        // ==================================================
        // RESPONSE
        // ==================================================

        res.json({

            message:
                "Patient vitals updated successfully",

            patient: {

                patientId:
                    patient.patientId,

                name:
                    patient.name,

                room:
                    patient.room,

                heartRate:
                    patient.heartRate,

                spo2:
                    patient.spo2,

                temperature:
                    patient.temperature,

                risk:
                    patient.risk,

                riskScore:
                    patient.riskScore,

                riskReasons:
                    patient.riskReasons,

                riskSummary:
                    patient.riskSummary,

                recommendedAction:
                    patient.recommendedAction,

                roomContext:
                    patient.roomContext
            },

            history: {

                id:
                    vital._id,

                timestamp:
                    vital.createdAt
            }
        });

    } catch (error) {

        console.error(
            "Failed to update patient vitals:",
            error
        );

        res.status(500).json({
            error:
                "Failed to update patient vitals"
        });
    }
});


// ======================================================
// GET PATIENT VITAL HISTORY
// ======================================================

router.get("/:patientId/history", async (req, res) => {

    try {

        const vitals = await Vital.find({
            patientId: req.params.patientId
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