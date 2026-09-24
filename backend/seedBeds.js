require("dotenv").config();
const mongoose = require("mongoose");

const Bed = require("./models/Bed");

const sampleBeds = [
    { bedId: "B-101-01", ward: "General Ward", room: "101", bedNumber: "01", status: "AVAILABLE" },
    { bedId: "B-101-02", ward: "General Ward", room: "101", bedNumber: "02", status: "OCCUPIED", patientId: "P003", patientName: "Ava Patel" },
    { bedId: "B-101-03", ward: "General Ward", room: "101", bedNumber: "03", status: "AVAILABLE" },
    { bedId: "B-101-04", ward: "General Ward", room: "101", bedNumber: "04", status: "MAINTENANCE" },
    { bedId: "B-102-01", ward: "General Ward", room: "102", bedNumber: "01", status: "AVAILABLE" },
    { bedId: "B-102-02", ward: "General Ward", room: "102", bedNumber: "02", status: "AVAILABLE" },
    { bedId: "B-102-03", ward: "General Ward", room: "102", bedNumber: "03", status: "AVAILABLE" },
    { bedId: "B-102-04", ward: "General Ward", room: "102", bedNumber: "04", status: "MAINTENANCE" },
    { bedId: "B-103-01", ward: "General Ward", room: "103", bedNumber: "01", status: "AVAILABLE" },
    { bedId: "B-103-02", ward: "General Ward", room: "103", bedNumber: "02", status: "AVAILABLE" }
];

async function seedBeds() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log("Connected to MongoDB for bed seeding");

        for (const bedData of sampleBeds) {
            const existing = await Bed.findOne({ bedId: bedData.bedId });
            if (!existing) {
                await Bed.create(bedData);
                console.log(`Inserted ${bedData.bedId}`);
            } else {
                console.log(`Skipped existing ${bedData.bedId}`);
            }
        }

        console.log("Bed seeding complete");
    } catch (error) {
        console.error("Bed seeding failed:", error.message);
    } finally {
        await mongoose.disconnect();
    }
}

seedBeds();
