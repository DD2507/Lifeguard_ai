const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
require("dotenv").config();

const { startMQTTBroker } = require("./services/mqttBroker");

const app = express();
const { router: patientRoutes } = require("./routes/patients");
const { router: roomRoutes } = require("./routes/rooms");
const vitalRoutes = require("./routes/vitals");
const alertRoutes = require("./routes/alerts");
app.use(cors());
app.use(express.json());
app.use("/api/patients", patientRoutes);
app.use("/api/rooms", roomRoutes);
app.use("/api/vitals", vitalRoutes);
app.use("/api/alerts", alertRoutes);

mongoose
    .connect(process.env.MONGODB_URI)
    .then(() => {
        console.log("MongoDB connected successfully");
    })
    .catch((error) => {
        console.error("MongoDB connection failed:", error.message);
    });

app.get("/", (req, res) => {
    res.json({
        message: "LifeGuard AI Server is running"
    });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`LifeGuard AI server running on http://localhost:${PORT}`);
    startMQTTBroker();
});