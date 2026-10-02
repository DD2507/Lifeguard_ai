const mongoose = require("mongoose");

const prescriptionSchema = new mongoose.Schema(
    {
        patientId: {
            type: String,
            required: true,
            index: true,
            trim: true
        },

        doctorId: {
            type: String,
            default: "DOC-001",
            trim: true
        },

        treatmentName: {
            type: String,
            required: true,
            trim: true
        },

        type: {
            type: String,
            enum: [
                "Medication",
                "IV Fluid",
                "Injection",
                "Therapy",
                "Vital Check",
                "Other"
            ],
            default: "Medication"
        },

        dosage: {
            type: String,
            required: true,
            trim: true
        },

        scheduledTime: {
            type: String,
            required: true,
            trim: true
        },

        scheduledAt: {
            type: Date,
            index: true
        },

        reminderDeliveredAt: {
            type: Date,
            default: undefined
        },

        reminderEmittedAt: { type: Date, default: undefined },
        reminderClaimedAt: { type: Date, default: undefined },
        reminderClaimToken: { type: String, default: undefined },
        reminderAlertId: { type: String, default: undefined },

        frequency: {
            type: String,
            enum: [
                "Once only",
                "Once daily",
                "Twice daily",
                "Three times daily",
                "Every 8 hours",
                "Every 12 hours",
                "As needed"
            ],
            default: "Once daily"
        },

        startDate: {
            type: Date,
            default: Date.now
        },

        endDate: {
            type: Date,
            default: null
        },

        duration: {
            type: String,
            default: ""
        },

        instructions: {
            type: String,
            default: "",
            trim: true
        },

        status: {
            type: String,
            enum: ["ACTIVE", "COMPLETED", "CANCELLED"],
            default: "ACTIVE",
            index: true
        }
    },
    {
        timestamps: true
    }
);

prescriptionSchema.index({ status: 1, scheduledAt: 1, reminderDeliveredAt: 1 });

module.exports = mongoose.model("Prescription", prescriptionSchema);
