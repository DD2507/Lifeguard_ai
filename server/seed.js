const mongoose = require("mongoose");
require("dotenv").config();

const Patient = require("./models/Patient");

const patients = [
    {
        patientId: "P003",
        name: "Patient 003",
        room: "102",
        heartRate: 108,
        spo2: 92,
        temperature: 38.2,
        risk: "HIGH"
    },
    {
        patientId: "P012",
        name: "Patient 012",
        room: "105",
        heartRate: 82,
        spo2: 97,
        temperature: 36.8,
        risk: "LOW"
    },
    {
        patientId: "P007",
        name: "Patient 007",
        room: "103",
        heartRate: 96,
        spo2: 95,
        temperature: 37.4,
        risk: "MODERATE"
    },
    {
        patientId: "P015",
        name: "Patient 015",
        room: "107",
        heartRate: 76,
        spo2: 98,
        temperature: 36.6,
        risk: "LOW"
    }
];

async function seedDatabase() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);

        await Patient.deleteMany({});
        await Patient.insertMany(patients);

        console.log("Patients added successfully!");

        await mongoose.disconnect();
    } catch (error) {
        console.error("Seeding failed:", error.message);
        process.exit(1);
    }
}

seedDatabase();