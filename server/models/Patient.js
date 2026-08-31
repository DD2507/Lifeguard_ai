const mongoose = require("mongoose");

const patientSchema = new mongoose.Schema(
    {
        patientId: {
            type: String,
            required: true,
            unique: true,
            trim: true
        },

        name: {
            type: String,
            required: true,
            trim: true
        },

        room: {
            type: String,
            required: true,
            trim: true
        },

        // Current patient vitals
        heartRate: {
            type: Number,
            default: 0
        },

        spo2: {
            type: Number,
            default: 0
        },

        temperature: {
            type: Number,
            default: 0
        },

        // Current risk assessment
        risk: {
            type: String,
            enum: ["LOW", "MODERATE", "HIGH"],
            default: "LOW"
        },

        riskScore: {
            type: Number,
            default: 0
        },

        // Detailed explanation of the risk
        riskReasons: [
            {
                factor: {
                    type: String
                },

                value: {
                    type: Number
                },

                severity: {
                    type: String,
                    enum: ["NORMAL", "MODERATE", "HIGH"]
                },

                explanation: {
                    type: String
                }
            }
        ],

        riskSummary: {
            type: String,
            default: ""
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

        // Environmental information from patient's room
        roomContext: {
            temperature: {
                type: Number,
                default: 0
            },

            humidity: {
                type: Number,
                default: 0
            },

            airQuality: {
                type: Number,
                default: 0
            },

            presenceDetected: {
                type: Boolean,
                default: false
            }
        }
    },

    {
        timestamps: true
    }
);

module.exports = mongoose.model("Patient", patientSchema);