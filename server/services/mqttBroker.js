const mqtt = require("mqtt");
const mongoose = require("mongoose");

const Patient = require("../models/Patient");
const Room = require("../models/room");

const { calculateRiskWithAI } = require("./riskEngine");

const { fallbackPatients } = require("../routes/patients");
const { fallbackRooms } = require("../routes/rooms");

const MQTT_URL = process.env.MQTT_URL || "mqtt://127.0.0.1:1883";

let mqttClient = null;

function startMQTTBroker() {
    mqttClient = mqtt.connect(MQTT_URL, {
        clientId: `lifeguard-node-${Date.now()}`,
        protocolVersion: 4,
        reconnectPeriod: 5000
    });

    mqttClient.on("connect", () => {
        console.log("LifeGuard AI connected to MQTT broker");

        mqttClient.subscribe(
            [
                "lifeguard/patient/+/vitals",
                "lifeguard/room/+/environment"
            ],
            (err) => {
                if (err) {
                    console.error("MQTT Subscribe Error:", err.message);
                } else {
                    console.log("MQTT subscriptions active");
                }
            }
        );
    });

    mqttClient.on("reconnect", () => {
        console.log("Reconnecting to MQTT broker...");
    });

    mqttClient.on("error", (err) => {
        console.error("MQTT Error:", err.message);
    });

    mqttClient.on("close", () => {
        console.log("MQTT connection closed");
    });

    mqttClient.on("message", async (topic, payload) => {
        const payloadStr = payload.toString();

        console.log(`MQTT message received: ${topic}`);

        try {
            const data = JSON.parse(payloadStr);

            if (
                topic.startsWith("lifeguard/patient/") &&
                topic.endsWith("/vitals")
            ) {
                const parts = topic.split("/");
                const patientId = parts[2];

                await handlePatientVitalsMQTT(patientId, data);
            } else if (
                topic.startsWith("lifeguard/room/") &&
                topic.endsWith("/environment")
            ) {
                const parts = topic.split("/");
                const roomId = parts[2];

                await handleRoomEnvironmentMQTT(roomId, data);
            }
        } catch (err) {
            console.error(
                "MQTT Message Processing Error:",
                err.message
            );
        }
    });
}

async function handlePatientVitalsMQTT(patientId, data) {
    const {
        heartRate,
        spo2,
        temperature
    } = data;

    let roomContext = {};

    if (mongoose.connection.readyState === 1) {
        const patient = await Patient.findOne({ patientId });

        if (patient) {
            const room = await Room.findOne({
                roomId: patient.room
            });

            if (room) {
                roomContext = {
                    temperature: room.temperature,
                    humidity: room.humidity,
                    airQuality: room.airQuality,
                    presenceDetected: room.presenceDetected
                };
            }

            const riskResult = await calculateRiskWithAI(
                {
                    heartRate,
                    spo2,
                    temperature
                },
                roomContext
            );

            patient.heartRate = heartRate;
            patient.spo2 = spo2;
            patient.temperature = temperature;

            patient.risk = riskResult.risk;
            patient.riskScore = riskResult.riskScore;
            patient.riskReasons = riskResult.riskReasons;
            patient.riskSummary = riskResult.riskSummary;
            patient.recommendedAction =
                riskResult.recommendedAction;

            await patient.save();

            console.log(
                `[MQTT Ingest DB] Patient ${patientId}: ` +
                `HR=${heartRate}, ` +
                `SpO2=${spo2}%, ` +
                `Temp=${temperature}°C ` +
                `-> AI Risk: ${riskResult.risk}`
            );

            publishRoomControlMQTT(
                patient.room,
                riskResult.recommendedAction
            );

            return;
        }
    }

    const memPatient = fallbackPatients.find(
        p => p.patientId === patientId
    );

    if (memPatient) {
        memPatient.heartRate = heartRate;
        memPatient.spo2 = spo2;
        memPatient.temperature = temperature;

        roomContext = memPatient.roomContext || {};

        const riskResult = await calculateRiskWithAI(
            {
                heartRate,
                spo2,
                temperature
            },
            roomContext
        );

        memPatient.risk = riskResult.risk;
        memPatient.riskScore = riskResult.riskScore;
        memPatient.riskReasons = riskResult.riskReasons;
        memPatient.riskSummary = riskResult.riskSummary;
        memPatient.recommendedAction =
            riskResult.recommendedAction;

        console.log(
            `[MQTT Ingest Mem] Patient ${patientId}: ` +
            `HR=${heartRate}, ` +
            `SpO2=${spo2}%, ` +
            `Temp=${temperature}°C ` +
            `-> AI Risk: ${riskResult.risk}`
        );

        publishRoomControlMQTT(
            memPatient.room,
            riskResult.recommendedAction
        );
    } else {
        console.log(
            `Patient ${patientId} not found in DB or fallback data`
        );
    }
}

async function handleRoomEnvironmentMQTT(roomId, data) {
    const {
        temperature,
        humidity,
        airQuality,
        presenceDetected
    } = data;

    if (mongoose.connection.readyState === 1) {
        await Room.findOneAndUpdate(
            { roomId },
            {
                temperature,
                humidity,
                airQuality,
                presenceDetected,
                lastUpdated: new Date()
            },
            {
                upsert: true
            }
        );

        console.log(
            `[MQTT Ingest DB] Room ${roomId}: ` +
            `Temp=${temperature}°C, ` +
            `Humidity=${humidity}%, ` +
            `AirQuality=${airQuality}`
        );
    }

    const memRoom = fallbackRooms.find(
        r => r.roomId === roomId
    );

    if (memRoom) {
        memRoom.temperature = temperature;
        memRoom.humidity = humidity;
        memRoom.airQuality = airQuality;
        memRoom.presenceDetected = presenceDetected;
    }

    fallbackPatients
        .filter(p => p.room === roomId)
        .forEach(p => {
            p.roomContext = {
                temperature,
                humidity,
                airQuality,
                presenceDetected
            };
        });

    console.log(
        `[MQTT Ingest Mem] Room ${roomId}: ` +
        `Temp=${temperature}°C, ` +
        `Humidity=${humidity}%, ` +
        `AirQuality=${airQuality}`
    );
}

function publishRoomControlMQTT(roomId, action) {
    if (!mqttClient || !mqttClient.connected) {
        console.log(
            "MQTT not connected. Control command not sent."
        );
        return;
    }

    const controlTopic =
        `lifeguard/room/${roomId}/control`;

    const payload = JSON.stringify(action);

    mqttClient.publish(
        controlTopic,
        payload,
        {
            qos: 0,
            retain: false
        },
        (err) => {
            if (err) {
                console.error(
                    "MQTT Actuation Error:",
                    err.message
                );
                return;
            }

            console.log(
                `[MQTT Actuation -> ESP32] ` +
                `Sent control command to ${controlTopic}: ` +
                `Fan=${action.fan ? "ON" : "OFF"}, ` +
                `Buzzer=${action.buzzer ? "ON" : "OFF"}`
            );
        }
    );
}

module.exports = {
    startMQTTBroker,
    publishRoomControlMQTT
};