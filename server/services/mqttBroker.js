const net = require("net");
const mongoose = require("mongoose");
const { Aedes } = require("aedes");
const aedes = new Aedes();

const Patient = require("../models/Patient");
const Room = require("../models/room");
const { calculateRiskWithAI } = require("./riskEngine");
const { fallbackPatients } = require("../routes/patients");
const { fallbackRooms } = require("../routes/rooms");

const MQTT_PORT = process.env.MQTT_PORT || 1883;

function startMQTTBroker() {
    const server = net.createServer(aedes.handle);

    server.listen(MQTT_PORT, function () {
        console.log(`📡 LifeGuard AI Embedded MQTT Broker listening on port ${MQTT_PORT}`);
    });

    aedes.on("client", function (client) {
        console.log(`🔌 MQTT Client Connected: ${client ? client.id : "Unknown"}`);
    });

    aedes.on("clientDisconnect", function (client) {
        console.log(`🔌 MQTT Client Disconnected: ${client ? client.id : "Unknown"}`);
    });

    aedes.on("publish", async function (packet, client) {
        if (!packet.topic || packet.topic.startsWith("$SYS")) {
            return;
        }

        const topic = packet.topic;
        const payloadStr = packet.payload.toString();

        try {
            const data = JSON.parse(payloadStr);

            // ==================================================
            // PATIENT VITALS TOPIC: lifeguard/patient/<patientId>/vitals
            // ==================================================
            if (topic.startsWith("lifeguard/patient/") && topic.endsWith("/vitals")) {
                const parts = topic.split("/");
                const patientId = parts[2];

                await handlePatientVitalsMQTT(patientId, data);
            }

            // ==================================================
            // ROOM ENVIRONMENT TOPIC: lifeguard/room/<roomId>/environment
            // ==================================================
            else if (topic.startsWith("lifeguard/room/") && topic.endsWith("/environment")) {
                const parts = topic.split("/");
                const roomId = parts[2];

                await handleRoomEnvironmentMQTT(roomId, data);
            }
        } catch (err) {
            // Ignore non-JSON system packets
        }
    });
}

async function handlePatientVitalsMQTT(patientId, data) {
    const { heartRate, spo2, temperature } = data;

    let roomContext = {};
    let roomNum = "102";

    if (mongoose.connection.readyState === 1) {
        let patient = await Patient.findOne({ patientId });
        if (patient) {
            roomNum = patient.room;
            const room = await Room.findOne({ roomId: patient.room });
            if (room) {
                roomContext = {
                    temperature: room.temperature,
                    humidity: room.humidity,
                    airQuality: room.airQuality,
                    presenceDetected: room.presenceDetected
                };
            }

            const riskResult = await calculateRiskWithAI(
                { heartRate, spo2, temperature },
                roomContext
            );

            patient.heartRate = heartRate;
            patient.spo2 = spo2;
            patient.temperature = temperature;
            patient.risk = riskResult.risk;
            patient.riskScore = riskResult.riskScore;
            patient.riskReasons = riskResult.riskReasons;
            patient.riskSummary = riskResult.riskSummary;
            patient.recommendedAction = riskResult.recommendedAction;
            await patient.save();

            console.log(`⚡ [MQTT Ingest DB] Patient ${patientId}: HR=${heartRate}, SpO2=${spo2}%, Temp=${temperature}°C -> AI Risk: ${riskResult.risk}`);
            publishRoomControlMQTT(patient.room, riskResult.recommendedAction);
            return;
        }
    }

    // In-memory fallback update
    let memPatient = fallbackPatients.find(p => p.patientId === patientId);
    if (memPatient) {
        memPatient.heartRate = heartRate;
        memPatient.spo2 = spo2;
        memPatient.temperature = temperature;

        roomContext = memPatient.roomContext || {};
        const riskResult = await calculateRiskWithAI(
            { heartRate, spo2, temperature },
            roomContext
        );

        memPatient.risk = riskResult.risk;
        memPatient.riskScore = riskResult.riskScore;
        memPatient.riskReasons = riskResult.riskReasons;
        memPatient.riskSummary = riskResult.riskSummary;
        memPatient.recommendedAction = riskResult.recommendedAction;

        console.log(`⚡ [MQTT Ingest Mem] Patient ${patientId}: HR=${heartRate}, SpO2=${spo2}%, Temp=${temperature}°C -> AI Risk: ${riskResult.risk}`);
        publishRoomControlMQTT(memPatient.room, riskResult.recommendedAction);
    }
}

async function handleRoomEnvironmentMQTT(roomId, data) {
    const { temperature, humidity, airQuality, presenceDetected } = data;

    if (mongoose.connection.readyState === 1) {
        await Room.findOneAndUpdate(
            { roomId },
            { temperature, humidity, airQuality, presenceDetected, lastUpdated: new Date() },
            { upsert: true }
        );
        console.log(`⚡ [MQTT Ingest DB] Room ${roomId}: Temp=${temperature}°C, Humidity=${humidity}%, AirQuality=${airQuality}`);
    }

    let memRoom = fallbackRooms.find(r => r.roomId === roomId);
    if (memRoom) {
        memRoom.temperature = temperature;
        memRoom.humidity = humidity;
        memRoom.airQuality = airQuality;
        memRoom.presenceDetected = presenceDetected;
    }

    fallbackPatients.filter(p => p.room === roomId).forEach(p => {
        p.roomContext = { temperature, humidity, airQuality, presenceDetected };
    });

    console.log(`⚡ [MQTT Ingest Mem] Room ${roomId}: Temp=${temperature}°C, Humidity=${humidity}%, AirQuality=${airQuality}`);
}

function publishRoomControlMQTT(roomId, action) {
    const controlTopic = `lifeguard/room/${roomId}/control`;
    const payload = JSON.stringify(action);

    aedes.publish({
        topic: controlTopic,
        payload: Buffer.from(payload),
        qos: 0,
        retain: false
    });

    console.log(`📤 [MQTT Actuation -> ESP32] Sent control command to ${controlTopic}: Fan=${action.fan ? "ON" : "OFF"}, Buzzer=${action.buzzer ? "ON" : "OFF"}`);
}

module.exports = {
    startMQTTBroker,
    publishRoomControlMQTT
};
