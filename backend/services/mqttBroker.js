const mqtt = require("mqtt");

const {
    processPatientVital
} = require("./patientVitalService");
const { updateRoomSensor } = require("./roomSensorService");
const { shouldProcessPatientPacket } = require("./demoPatientOverride");
const {
    HIGH_BPM_CONSECUTIVE_READINGS,
    getPersonalizedHighBpmThreshold,
    shouldActivateHighBpmAlarm
} = require("./heartRateActuatorPolicy");

const client = mqtt.connect(
    process.env.MQTT_BROKER_URL ||
    process.env.MQTT_URL ||
    "mqtt://10.222.14.64:1883"
);

const PATIENT_TOPIC = "lifeguard/patient/+/vitals";
const ROOM_ENVIRONMENT_TOPIC = "lifeguard/room/+/environment";

function publishRoomControlMQTT(roomId, action) {
    if (!client || !client.connected) {
        console.log(
            "MQTT not connected. Control command not sent."
        );
        return;
    }

    const controlTopic = `lifeguard/room/${roomId}/control`;
    const payload = JSON.stringify(action);

    client.publish(
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
                `Buzzer=${action.buzzer ? "ON" : "OFF"}, ` +
                `LED=${action.led ? "ON" : "OFF"}`
            );
        }
    );
}

function publishHighRiskDemoStop(patientId) {
    if (!client || !client.connected) {
        console.warn("MQTT not connected. High-risk demo stop command was not sent.");
        return Promise.resolve(false);
    }

    const topic = `lifeguard/demo/${patientId}/control`;
    const payload = JSON.stringify({ action: "STOP_HIGH_RISK_DEMO" });

    return new Promise((resolve) => {
        client.publish(topic, payload, { qos: 1, retain: false }, (error) => {
            if (error) {
                console.error("Failed to publish high-risk demo stop command:", error.message);
                resolve(false);
                return;
            }
            console.log(`[MQTT Demo Control] Stop command sent for ${patientId}`);
            resolve(true);
        });
    });
}

function startMQTT() {
    client.on("connect", () => {
        console.log("MQTT connected");

        client.subscribe([PATIENT_TOPIC, ROOM_ENVIRONMENT_TOPIC], (error) => {
            if (error) {
                console.error(
                    "MQTT subscription failed:",
                    error.message
                );
                return;
            }

            console.log(
                `Subscribed to ${PATIENT_TOPIC} and ${ROOM_ENVIRONMENT_TOPIC}`
            );
        });
    });

    client.on("error", (error) => {
        console.error(
            "MQTT error:",
            error.message
        );
    });

    client.on("message", async (topic, message, packet) => {
        try {
            const roomMatch = topic.match(
                /^lifeguard\/room\/([^/]+)\/environment$/
            );

            if (roomMatch) {
                const roomId = roomMatch[1];
                let data;
                try {
                    data = JSON.parse(message.toString());
                } catch {
                    const room = await updateRoomSensor(roomId, null, {
                        receivedAt: new Date(),
                        retained: Boolean(packet?.retain),
                        error: "MQTT room payload is not valid JSON"
                    });
                    console.warn(`Room ${roomId} sensor status: ${room.sensorStatus}`);
                    return;
                }

                const room = await updateRoomSensor(roomId, data, {
                    receivedAt: new Date(),
                    retained: Boolean(packet?.retain)
                });
                console.log(
                    `Room MQTT → ${roomId}: ${room.sensorStatus}`,
                    room.sensorStatus === "LIVE"
                        ? { temperature: room.temperature, humidity: room.humidity, airQuality: room.airQuality }
                        : room.lastSensorError
                );
                return;
            }

            const match = topic.match(
                /^lifeguard\/patient\/([^/]+)\/vitals$/
            );

            if (!match) {
                return;
            }

            const patientId = match[1];

            let data;
            try {
                data = JSON.parse(message.toString());
            } catch {
                if (!shouldProcessPatientPacket(patientId, null)) return;
                await processPatientVital(patientId, null, {
                    receivedAt: new Date(),
                    retained: Boolean(packet?.retain),
                    error: "MQTT payload is not valid JSON"
                });
                return;
            }

            if (!shouldProcessPatientPacket(patientId, data)) {
                console.log(
                    `MQTT reading → ${patientId}: ignored while the marked high-risk demo is active`
                );
                return;
            }

            console.log(
                `MQTT reading → ${patientId}:`,
                data
            );

            const result =
                await processPatientVital(
                    patientId,
                    data,
                    {
                        receivedAt: new Date(),
                        retained: Boolean(packet?.retain)
                    }
                );

            console.log(
                `Processing result → ${patientId}:`,
                result.baselineStatus
            );

            if (result.risk) {
                console.log(
                    `Risk → ${result.risk.risk} (${result.risk.riskScore})`
                );
            }

            const patient = result.patient;
            const roomId = patient && patient.room
                ? patient.room
                : patientId;

            const fingerDetected = data.fingerDetected === true;
            const heartRate = Number(data.heartRate || 0);
            const consecutiveHighReadings = Number(
                patient?.heartRateAlertState?.consecutiveHighReadings
            ) || 0;
            const heartRateAlert = shouldActivateHighBpmAlarm({
                fingerDetected,
                heartRate,
                consecutiveHighReadings,
                baselineHeartRate: patient?.baseline?.heartRate,
                baselineEstablished: result.baselineStatus === "ESTABLISHED"
            });
            const personalizedThreshold = getPersonalizedHighBpmThreshold({
                baselineHeartRate: patient?.baseline?.heartRate,
                baselineEstablished: result.baselineStatus === "ESTABLISHED"
            });

            const roomAction = {
                fan: result.risk?.recommendedAction?.fan === true,
                buzzer: heartRateAlert,
                led: heartRateAlert,
                reason: heartRateAlert
                    ? `Heart rate stayed above the personalized ${personalizedThreshold} BPM threshold for ${consecutiveHighReadings} consecutive IoT readings (current: ${heartRate} BPM).`
                    : (fingerDetected === true && personalizedThreshold !== null && heartRate > personalizedThreshold
                        ? `Waiting for ${HIGH_BPM_CONSECUTIVE_READINGS} consecutive readings above the personalized ${personalizedThreshold} BPM threshold (${consecutiveHighReadings}/${HIGH_BPM_CONSECUTIVE_READINGS}; current: ${heartRate} BPM).`
                    : (fingerDetected === true
                        ? (personalizedThreshold === null
                            ? "Patient baseline is not established. Physical alert disabled."
                            : "Heart rate is within the personalized physical alert limit.")
                        : "Finger not detected. Physical alert disabled."))
            };

            // Always publish, including OFF, so a broken high-BPM sequence
            // cannot leave the physical buzzer or LED latched on.
            publishRoomControlMQTT(roomId, roomAction);

        } catch (error) {
            console.error(
                "Failed to process MQTT message:",
                error.message
            );
        }
    });
}

module.exports = {
    startMQTT,
    mqttClient: client,
    publishRoomControlMQTT,
    publishHighRiskDemoStop
};
