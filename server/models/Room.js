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
            default: 0
        },

        humidity: {
            type: Number,
            default: 0
        },

        // MQ135
        airQuality: {
            type: Number,
            default: 0
        },

        // PIR - optional
        presenceDetected: {
            type: Boolean,
            default: false
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
            default: Date.now
        }
    },
    {
        timestamps: true
    }
);

module.exports = mongoose.model("Room", roomSchema);