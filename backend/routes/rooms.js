const express = require("express");

const Room = require("../models/room");
const Patient = require("../models/Patient");

const { effectiveBaselineStatus, getSensorStatus } = require("../services/patientVitalService");
const { presentRoom } = require("../services/roomSensorService");

function waitingRoom102() {
    return {
        roomId: "102",
        temperature: null,
        humidity: null,
        airQuality: null,
        presenceDetected: null,
        sensorStatus: "WAITING",
        connected: false,
        lastMessageAt: null,
        lastValidReadingAt: null,
        lastSensorError: "",
        source: null,
        fanStatus: false,
        buzzerStatus: false
    };
}

const router = express.Router();

// ======================================================
// GET ALL ROOMS
// ======================================================

router.get("/", async (req, res) => {
    try {
        const documents = await Room.find().sort({ roomId: 1 });
        const rooms = documents.map((room) => presentRoom(room));
        if (!rooms.some((room) => String(room.roomId) === "102")) {
            rooms.push(waitingRoom102());
            rooms.sort((left, right) => String(left.roomId).localeCompare(String(right.roomId), undefined, { numeric: true }));
        }

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

        res.json(presentRoom(room));

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

            // Keep the patient-facing room snapshot current even while its
            // physiological sensor or baseline is unavailable.
            patient.roomContext = roomContext;
            await patient.save();

            updatedPatients.push({
                patientId: patient.patientId,
                name: patient.name,
                risk: effectiveBaselineStatus(patient) === "ESTABLISHED"
                    ? patient.risk
                    : null,
                riskScore: effectiveBaselineStatus(patient) === "ESTABLISHED"
                    ? patient.riskScore
                    : null,
                baselineStatus: effectiveBaselineStatus(patient),
                sensorStatus: getSensorStatus(patient)
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
