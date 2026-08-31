const mongoose = require("mongoose");

const alertSchema = new mongoose.Schema(
    {
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
            required: true
        },

        riskScore: {
            type: Number,
            required: true
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
            enum: ["ACTIVE", "RESOLVED"],
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

module.exports = mongoose.model("Alert", alertSchema);