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
        heartRate: { type: Number, default: null },
        spo2: { type: Number, default: null },
        temperature: { type: Number, default: null },
        fingerDetected: { type: Boolean, default: false },
        baseline: {
            heartRate: { type: Number, default: null },
            spo2: { type: Number, default: null },
            temperature: { type: Number, default: null },
            sampleCount: { type: Number, default: 0 },
            calibrationStatus: {
                type: String,
                enum: ["BASELINE_CALIBRATING", "ESTABLISHED"],
                default: "BASELINE_CALIBRATING"
            },
            calibrationSamples: [{
                _id: false,
                heartRate: Number,
                spo2: Number,
                temperature: Number,
                receivedAt: Date
            }],
            establishedAt: { type: Date, default: null },
            baselineMethod: { type: String, default: "median" },
            skippedAbnormalSamples: { type: Number, default: 0 },
            established: { type: Boolean, default: false }
        },
        baselineDeviation: {
            heartRate: { type: Number, default: null },
            spo2: { type: Number, default: null },
            temperature: { type: Number, default: null }
        },
        sensorStatus: {
            type: String,
            enum: ["SENSOR_DISCONNECTED", "LIVE", "SENSOR_INVALID", "DATA_STALE"],
            default: "SENSOR_DISCONNECTED"
        },
        lastSensorMessageAt: { type: Date, default: null },
        lastValidReadingAt: { type: Date, default: null },
        lastSensorError: { type: String, default: "" },
        heartRateAlertState: {
            consecutiveHighReadings: { type: Number, default: 0 },
            lastHighHeartRate: { type: Number, default: null },
            notificationActive: { type: Boolean, default: false }
        },
        aiRisk: { type: String, enum: ["LOW", "MODERATE", "HIGH"], default: null },
        aiConfidence: { type: Number, default: null },
        aiInferenceAt: { type: Date, default: null },
        lastRiskAssessmentAt: { type: Date, default: null },
        risk: { type: String, enum: ["LOW", "MODERATE", "HIGH"], default: null },
        riskScore: { type: Number, default: null },
        riskReasons: [{
            factor: String,
            value: Number,
            severity: { type: String, enum: ["NORMAL", "MODERATE", "HIGH"] },
            explanation: String
        }],
        riskSummary: { type: String, default: "" },
        recommendedAction: {
            fan: { type: Boolean, default: false },
            buzzer: { type: Boolean, default: false },
            reason: { type: String, default: "" }
        },
        roomContext: {
            temperature: { type: Number, default: null },
            humidity: { type: Number, default: null },
            airQuality: { type: Number, default: null },
            presenceDetected: { type: Boolean, default: false }
        }
    },
    { timestamps: true }
);

module.exports = mongoose.model("Patient", patientSchema);
