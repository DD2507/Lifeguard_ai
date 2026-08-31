const mongoose = require("mongoose");

const patientSchema = new mongoose.Schema(
    {
        patientId: {
            type: String,
            required: true,
            unique: true
        },
        name: {
            type: String,
            required: true
        },
        room: {
            type: String,
            required: true
        },
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
        risk: {
            type: String,
            default: "LOW"
        }
    },
    {
        timestamps: true
    }
);

module.exports = mongoose.model("Patient", patientSchema);