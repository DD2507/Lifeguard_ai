const mongoose = require("mongoose");

const bedSchema = new mongoose.Schema(
    {
        bedId: {
            type: String,
            required: true,
            unique: true,
            trim: true
        },

        ward: {
            type: String,
            required: true,
            trim: true
        },

        room: {
            type: String,
            required: true,
            trim: true
        },

        bedNumber: {
            type: String,
            required: true,
            trim: true
        },

        status: {
            type: String,
            enum: ["AVAILABLE", "OCCUPIED", "MAINTENANCE"],
            default: "AVAILABLE",
            index: true
        },

        patientId: {
            type: String,
            default: null,
            trim: true
        },

        patientName: {
            type: String,
            default: null,
            trim: true
        }
    },
    {
        timestamps: true
    }
);

module.exports = mongoose.model("Bed", bedSchema);
