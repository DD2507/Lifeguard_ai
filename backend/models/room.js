const mongoose = require("mongoose");

const roomSchema = new mongoose.Schema(
    {
        roomId: {
            type: String,
            required: true,
            unique: true,
            trim: true
        },

        // DHT22
        temperature: {
            type: Number,
            default: null
        },

        humidity: {
            type: Number,
            default: null
        },

        // MQ135
        airQuality: {
            type: Number,
            default: null
        },

        source: {
            type: String,
            enum: ["MQTT", "API"],
            default: null
        },

        sensorStatus: {
            type: String,
            enum: ["SENSOR_DISCONNECTED", "LIVE", "SENSOR_INVALID", "DATA_STALE"],
            default: "SENSOR_DISCONNECTED"
        },

        lastMessageAt: {
            type: Date,
            default: null
        },

        lastValidReadingAt: {
            type: Date,
            default: null
        },

        lastSensorError: {
            type: String,
            default: ""
        },

        // PIR - optional
        presenceDetected: {
            type: Boolean,
            default: null
        },

        presenceLastUpdatedAt: {
            type: Date,
            default: null
        },

        // Current room response
        fanStatus: {
            type: Boolean,
            default: false
        },

        buzzerStatus: {
            type: Boolean,
            default: false
        },

        lastUpdated: {
            type: Date,
            default: null
        }
    },
    {
        timestamps: true
    }
);

module.exports = mongoose.model("Room", roomSchema);