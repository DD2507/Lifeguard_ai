const mongoose = require("mongoose");

const alertSchema = new mongoose.Schema(
    {
        alertType: {
            type: String,
            enum: ["PATIENT_RISK", "MEDICINE_DUE"],
            default: "PATIENT_RISK",
            index: true
        },

        occurrenceId: {
            type: String,
            default: undefined
        },

        prescriptionId: { type: String, default: undefined },
        treatmentName: { type: String, default: undefined },
        dosage: { type: String, default: undefined },
        instructions: { type: String, default: "" },
        scheduledAt: { type: Date, default: undefined },
        dueTime: { type: String, default: undefined },
        timeZone: { type: String, default: "Asia/Kolkata" },
        medicineStatus: {
            type: String,
            enum: ["MEDICINE_DUE", "ACKNOWLEDGED", "COMPLETED"],
            default: undefined
        },
        completedBy: { type: String, default: undefined },
        completedAt: { type: Date, default: undefined },

        patientId: {
            type: String,
            required: true,
            index: true
        },

        patientName: {
            type: String,
            required: true
        },

        room: {
            type: String,
            required: true
        },

        risk: {
            type: String,
            enum: ["MODERATE", "HIGH"],
            required: false
        },

        riskScore: {
            type: Number,
            required: false
        },

        // Detailed reasons behind the alert
        reasons: [
            {
                factor: {
                    type: String
                },

                value: {
                    type: Number
                },

                severity: {
                    type: String
                },

                explanation: {
                    type: String
                }
            }
        ],

        summary: {
            type: String,
            required: true
        },

        // Recommended room response
        recommendedAction: {
            fan: {
                type: Boolean,
                default: false
            },

            buzzer: {
                type: Boolean,
                default: false
            },

            reason: {
                type: String,
                default: ""
            }
        },

        status: {
            type: String,
            enum: ["ACTIVE", "ACKNOWLEDGED", "COMPLETED", "RESOLVED"],
            default: "ACTIVE"
        },

        resolvedAt: {
            type: Date,
            default: null
        }
    },
    {
        timestamps: true
    }
);

alertSchema.index({ occurrenceId: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model("Alert", alertSchema);
