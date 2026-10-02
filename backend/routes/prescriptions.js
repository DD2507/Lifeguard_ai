const express = require("express");
const mongoose = require("mongoose");

const Prescription = require("../models/Prescription");
const Patient = require("../models/Patient");
const { completeMedicineDose } = require("../services/prescriptionCompletionService");
const { getNotificationSocket, notifyPrescriptionCreated } = require("../services/notificationService");
const { resolveScheduledAt } = require("../services/prescriptionReminderScheduler");

const router = express.Router();

// ======================================================
// CREATE PRESCRIPTION / TREATMENT
// ======================================================
router.post("/", async (req, res) => {
    try {
        const {
            patientId,
            doctorId,
            treatmentName,
            type,
            dosage,
            scheduledTime,
            frequency,
            startDate,
            endDate,
            duration,
            instructions
        } = req.body;

        if (!patientId || !treatmentName || !dosage || !scheduledTime) {
            return res.status(400).json({
                error: "patientId, treatmentName, dosage, and scheduledTime are required"
            });
        }

        const scheduledAt = resolveScheduledAt({ scheduledAt: req.body.scheduledAt, scheduledTime, startDate });
        if (!scheduledAt) {
            return res.status(400).json({
                error: "A valid scheduled date and time are required (Asia/Kolkata)"
            });
        }

        // Validate that patient exists in the system
        const patient = await Patient.findOne({ patientId: patientId.trim() });
        if (!patient) {
            return res.status(404).json({
                error: `Patient with ID '${patientId}' not found`
            });
        }

        const prescription = await Prescription.create({
            patientId: patientId.trim(),
            doctorId: doctorId ? doctorId.trim() : "DOC-001",
            treatmentName: treatmentName.trim(),
            type: type || "Medication",
            dosage: dosage.trim(),
            scheduledTime: scheduledTime.trim(),
            scheduledAt,
            frequency: frequency || "Once daily",
            startDate: startDate ? new Date(startDate) : new Date(),
            endDate: endDate ? new Date(endDate) : null,
            duration: duration || "",
            instructions: instructions ? instructions.trim() : "",
            status: "ACTIVE"
        });

        const io = getNotificationSocket();
        if (io) {
            notifyPrescriptionCreated(io, prescription.toObject ? prescription.toObject() : prescription);
        }

        res.status(201).json(prescription);
    } catch (error) {
        console.error("Failed to create prescription:", error);
        res.status(500).json({
            error: "Failed to create prescription"
        });
    }
});

// ======================================================
// GET ALL PRESCRIPTIONS FOR A PATIENT
// ======================================================
router.get("/patient/:patientId", async (req, res) => {
    try {
        const { patientId } = req.params;

        const prescriptions = await Prescription.find({
            patientId: patientId.trim()
        }).sort({ createdAt: -1 });

        res.json(prescriptions);
    } catch (error) {
        console.error("Failed to fetch patient prescriptions:", error);
        res.status(500).json({
            error: "Failed to fetch patient prescriptions"
        });
    }
});

// ======================================================
// GET SINGLE PRESCRIPTION
// ======================================================
router.get("/:id", async (req, res) => {
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                error: "Invalid prescription ID format"
            });
        }

        const prescription = await Prescription.findById(id);
        if (!prescription) {
            return res.status(404).json({
                error: "Prescription not found"
            });
        }

        res.json(prescription);
    } catch (error) {
        console.error("Failed to fetch prescription:", error);
        res.status(500).json({
            error: "Failed to fetch prescription"
        });
    }
});

// ======================================================
// UPDATE PRESCRIPTION DETAILS
// ======================================================
router.put("/:id", async (req, res) => {
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                error: "Invalid prescription ID format"
            });
        }

        const currentPrescription = await Prescription.findById(id);
        if (!currentPrescription) {
            return res.status(404).json({
                error: "Prescription not found"
            });
        }

        const {
            treatmentName,
            type,
            dosage,
            scheduledTime,
            frequency,
            startDate,
            endDate,
            duration,
            instructions,
            status
        } = req.body;

        const updateData = {};
        if (treatmentName !== undefined) {
            if (typeof treatmentName !== "string" || !treatmentName.trim()) {
                return res.status(400).json({ error: "treatmentName cannot be empty" });
            }
            updateData.treatmentName = treatmentName.trim();
        }
        if (type !== undefined) updateData.type = type;
        if (dosage !== undefined) {
            if (typeof dosage !== "string" || !dosage.trim()) {
                return res.status(400).json({ error: "dosage cannot be empty" });
            }
            updateData.dosage = dosage.trim();
        }
        if (scheduledTime !== undefined) updateData.scheduledTime = scheduledTime.trim();
        if (frequency !== undefined) updateData.frequency = frequency;
        if (startDate !== undefined) updateData.startDate = new Date(startDate);
        if (endDate !== undefined) updateData.endDate = endDate ? new Date(endDate) : null;
        if (duration !== undefined) updateData.duration = duration;
        if (instructions !== undefined) updateData.instructions = instructions.trim();
        if (status !== undefined) {
            if (!["ACTIVE", "COMPLETED", "CANCELLED"].includes(status)) {
                return res.status(400).json({
                    error: "Invalid status. Must be ACTIVE, COMPLETED, or CANCELLED"
                });
            }
            updateData.status = status;
        }

        const scheduleChanged =
            scheduledTime !== undefined ||
            startDate !== undefined ||
            req.body.scheduledAt !== undefined;
        if (scheduleChanged || !currentPrescription.scheduledAt) {
            const scheduledAt = resolveScheduledAt({
                scheduledAt: req.body.scheduledAt,
                scheduledTime: scheduledTime ?? currentPrescription.scheduledTime,
                startDate: startDate ?? currentPrescription.startDate
            });
            if (scheduleChanged && !scheduledAt) {
                return res.status(400).json({
                    error: "A valid scheduled date and time are required (Asia/Kolkata)"
                });
            }
            if (scheduledAt) {
                updateData.scheduledAt = scheduledAt;
            }
        }

        const update = { $set: updateData };
        if (scheduleChanged) {
            update.$unset = {
                reminderDeliveredAt: 1,
                reminderEmittedAt: 1,
                reminderClaimedAt: 1,
                reminderClaimToken: 1,
                reminderAlertId: 1
            };
        }

        const prescription = await Prescription.findByIdAndUpdate(
            id,
            update,
            { new: true, runValidators: true }
        );

        if (!prescription) {
            return res.status(404).json({
                error: "Prescription not found"
            });
        }

        res.json({
            message: "Prescription updated successfully",
            prescription
        });
    } catch (error) {
        console.error("Failed to update prescription:", error);
        res.status(500).json({
            error: "Failed to update prescription"
        });
    }
});

// ======================================================
// UPDATE PRESCRIPTION STATUS (ACTIVE / COMPLETED / CANCELLED)
// ======================================================
router.patch("/:id/status", async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                error: "Invalid prescription ID format"
            });
        }

        if (!status || !["ACTIVE", "COMPLETED", "CANCELLED"].includes(status)) {
            return res.status(400).json({
                error: "status is required and must be ACTIVE, COMPLETED, or CANCELLED"
            });
        }

        const completion = status === "COMPLETED"
            ? await completeMedicineDose({ prescriptionId: id })
            : null;
        const prescription = completion?.prescription || (status === "COMPLETED"
            ? null
            : await Prescription.findByIdAndUpdate(id, { status }, { new: true }));

        if (!prescription) {
            return res.status(404).json({
                error: "Prescription not found"
            });
        }

        res.json({
            message: `Prescription marked as ${status.toLowerCase()}`,
            prescription
        });
    } catch (error) {
        console.error("Failed to update prescription status:", error);
        res.status(500).json({
            error: "Failed to update prescription status"
        });
    }
});

// ======================================================
// DELETE PRESCRIPTION
// ======================================================
router.delete("/:id", async (req, res) => {
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                error: "Invalid prescription ID format"
            });
        }

        const prescription = await Prescription.findByIdAndDelete(id);

        if (!prescription) {
            return res.status(404).json({
                error: "Prescription not found"
            });
        }

        res.json({
            message: "Prescription deleted successfully",
            id
        });
    } catch (error) {
        console.error("Failed to delete prescription:", error);
        res.status(500).json({
            error: "Failed to delete prescription"
        });
    }
});

module.exports = router;
