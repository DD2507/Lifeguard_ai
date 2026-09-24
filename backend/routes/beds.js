const express = require("express");
const mongoose = require("mongoose");

const Bed = require("../models/Bed");
const Patient = require("../models/Patient");

const router = express.Router();

// ======================================================
// GET ALL BEDS
// ======================================================
router.get("/", async (req, res) => {
    try {
        const beds = await Bed.find().sort({ bedId: 1 });
        res.json(beds);
    } catch (error) {
        console.error("Failed to fetch beds:", error);
        res.status(500).json({ error: "Failed to fetch beds" });
    }
});

// ======================================================
// GET AVAILABLE BEDS
// ======================================================
router.get("/available", async (req, res) => {
    try {
        const beds = await Bed.find({ status: "AVAILABLE" }).sort({ bedId: 1 });
        res.json(beds);
    } catch (error) {
        console.error("Failed to fetch available beds:", error);
        res.status(500).json({ error: "Failed to fetch available beds" });
    }
});

// ======================================================
// GET BED BY ID
// ======================================================
router.get("/:bedId", async (req, res) => {
    try {
        const { bedId } = req.params;
        const bed = await Bed.findOne({ bedId: bedId.trim() });

        if (!bed) {
            return res.status(404).json({ error: "Bed not found" });
        }

        res.json(bed);
    } catch (error) {
        console.error("Failed to fetch bed:", error);
        res.status(500).json({ error: "Failed to fetch bed" });
    }
});

// ======================================================
// CREATE BED
// ======================================================
router.post("/", async (req, res) => {
    try {
        const {
            bedId,
            ward,
            room,
            bedNumber,
            status,
            patientId,
            patientName
        } = req.body;

        if (!bedId || !ward || !room || !bedNumber) {
            return res.status(400).json({
                error: "bedId, ward, room, and bedNumber are required"
            });
        }

        const existingBed = await Bed.findOne({ bedId: bedId.trim() });
        if (existingBed) {
            return res.status(409).json({ error: "Bed with this bedId already exists" });
        }

        const bed = await Bed.create({
            bedId: bedId.trim(),
            ward: ward.trim(),
            room: room.trim(),
            bedNumber: bedNumber.trim(),
            status: ["AVAILABLE", "OCCUPIED", "MAINTENANCE"].includes(status)
                ? status
                : "AVAILABLE",
            patientId: patientId || null,
            patientName: patientName || null
        });

        res.status(201).json(bed);
    } catch (error) {
        console.error("Failed to create bed:", error);
        res.status(500).json({ error: "Failed to create bed" });
    }
});

// ======================================================
// UPDATE BED
// ======================================================
router.put("/:bedId", async (req, res) => {
    try {
        const { bedId } = req.params;
        const {
            ward,
            room,
            bedNumber,
            status,
            patientId,
            patientName
        } = req.body;

        const bed = await Bed.findOne({ bedId: bedId.trim() });
        if (!bed) {
            return res.status(404).json({ error: "Bed not found" });
        }

        if (ward !== undefined) bed.ward = ward.trim();
        if (room !== undefined) bed.room = room.trim();
        if (bedNumber !== undefined) bed.bedNumber = bedNumber.trim();
        if (status !== undefined) {
            if (!["AVAILABLE", "OCCUPIED", "MAINTENANCE"].includes(status)) {
                return res.status(400).json({ error: "Invalid status value" });
            }
            bed.status = status;
        }
        if (patientId !== undefined) bed.patientId = patientId || null;
        if (patientName !== undefined) bed.patientName = patientName || null;

        await bed.save();
        res.json(bed);
    } catch (error) {
        console.error("Failed to update bed:", error);
        res.status(500).json({ error: "Failed to update bed" });
    }
});

// ======================================================
// ASSIGN BED
// ======================================================
router.patch("/:bedId/assign", async (req, res) => {
    try {
        const { bedId } = req.params;
        const { patientId } = req.body;

        if (!patientId) {
            return res.status(400).json({ error: "patientId is required" });
        }

        const bed = await Bed.findOne({ bedId: bedId.trim() });
        if (!bed) {
            return res.status(404).json({ error: "Bed not found" });
        }

        if (bed.status !== "AVAILABLE") {
            return res.status(400).json({
                error: `Bed is not available. Current status: ${bed.status}`
            });
        }

        const patient = await Patient.findOne({ patientId: patientId.trim() });
        if (!patient) {
            return res.status(404).json({ error: `Patient with ID '${patientId}' not found` });
        }

        bed.status = "OCCUPIED";
        bed.patientId = patient.patientId;
        bed.patientName = patient.name;

        await bed.save();
        res.json(bed);
    } catch (error) {
        console.error("Failed to assign bed:", error);
        res.status(500).json({ error: "Failed to assign bed" });
    }
});

// ======================================================
// RELEASE BED
// ======================================================
router.patch("/:bedId/release", async (req, res) => {
    try {
        const { bedId } = req.params;
        const bed = await Bed.findOne({ bedId: bedId.trim() });

        if (!bed) {
            return res.status(404).json({ error: "Bed not found" });
        }

        bed.status = "AVAILABLE";
        bed.patientId = null;
        bed.patientName = null;

        await bed.save();
        res.json(bed);
    } catch (error) {
        console.error("Failed to release bed:", error);
        res.status(500).json({ error: "Failed to release bed" });
    }
});

// ======================================================
// MAINTENANCE
// ======================================================
router.patch("/:bedId/maintenance", async (req, res) => {
    try {
        const { bedId } = req.params;
        const bed = await Bed.findOne({ bedId: bedId.trim() });

        if (!bed) {
            return res.status(404).json({ error: "Bed not found" });
        }

        bed.status = "MAINTENANCE";
        bed.patientId = null;
        bed.patientName = null;

        await bed.save();
        res.json(bed);
    } catch (error) {
        console.error("Failed to place bed in maintenance:", error);
        res.status(500).json({ error: "Failed to place bed in maintenance" });
    }
});

// ======================================================
// AVAILABLE
// ======================================================
router.patch("/:bedId/available", async (req, res) => {
    try {
        const { bedId } = req.params;
        const bed = await Bed.findOne({ bedId: bedId.trim() });

        if (!bed) {
            return res.status(404).json({ error: "Bed not found" });
        }

        bed.status = "AVAILABLE";
        bed.patientId = null;
        bed.patientName = null;

        await bed.save();
        res.json(bed);
    } catch (error) {
        console.error("Failed to set bed available:", error);
        res.status(500).json({ error: "Failed to set bed available" });
    }
});

// ======================================================
// DELETE BED
// ======================================================
router.delete("/:bedId", async (req, res) => {
    try {
        const { bedId } = req.params;
        const bed = await Bed.findOne({ bedId: bedId.trim() });

        if (!bed) {
            return res.status(404).json({ error: "Bed not found" });
        }

        if (bed.status === "OCCUPIED") {
            return res.status(400).json({
                error: "Cannot delete an occupied bed. Release the bed first."
            });
        }

        await Bed.deleteOne({ _id: bed._id });
        res.json({ message: "Bed deleted successfully", bedId: bed.bedId });
    } catch (error) {
        console.error("Failed to delete bed:", error);
        res.status(500).json({ error: "Failed to delete bed" });
    }
});

module.exports = router;
