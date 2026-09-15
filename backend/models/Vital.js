const mongoose = require("mongoose");


const { calculateRisk } = require("../services/riskEngine");

const {
    BASELINE_SAMPLE_COUNT,
    addSample,
    calculateBaseline,
    calculateDeviation
} = require("../services/baselineService");

const vitalSchema = new mongoose.Schema(
    {
        patientId: {
            type: String,
            required: true,
            index: true
        },

        room: {
            type: String,
            required: true
        },

        heartRate: {
            type: Number,
            required: true
        },

        spo2: {
            type: Number,
            required: true
        },

        temperature: {
            type: Number,
            required: true
        },

        // Deviation from patient's personal baseline
        baselineDeviation: {
            heartRate: {
                type: Number,
                default: null
            },

            spo2: {
                type: Number,
                default: null
            },

            temperature: {
                type: Number,
                default: null
            }
        },

        // Risk assessment at the time of this reading
        risk: {
            type: String,
            enum: ["LOW", "MODERATE", "HIGH"],
            default: "LOW"
        },

        riskScore: {
            type: Number,
            default: 0
        },

        // Explanation of the risk at this point in time
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
        }
    },
    {
        timestamps: true
    }
);

module.exports = mongoose.model("Vital", vitalSchema);