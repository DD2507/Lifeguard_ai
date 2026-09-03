const mqtt = require("mqtt");
const mongoose = require("mongoose");

const Patient = require("../models/Patient");
const Room = require("../models/room");
const Vital = require("../models/Vital");
const Alert = require("../models/Alert");


const { calculateRiskWithAI } = require("./riskEngine");

const { fallbackPatients } = require("../routes/patients");
const { fallbackRooms } = require("../routes/rooms");

const MQTT_URL =
    process.env.MQTT_URL || "mqtt://127.0.0.1:1883";

let mqttClient = null;

// ======================================================
// START MQTT CLIENT
// ======================================================

function startMQTTBroker() {

    mqttClient = mqtt.connect(MQTT_URL, {
        clientId: `lifeguard-node-${Date.now()}`,
        protocolVersion: 4,
        reconnectPeriod: 5000
    });

    // ==================================================
    // MQTT CONNECTED
    // ==================================================

    mqttClient.on("connect", () => {

        console.log(
            "LifeGuard AI connected to MQTT broker"
        );

        mqttClient.subscribe(
            [
                "lifeguard/patient/+/vitals",
                "lifeguard/room/+/environment"
            ],
            (err) => {

                if (err) {

                    console.error(
                        "MQTT Subscribe Error:",
                        err.message
                    );

                } else {

                    console.log(
                        "MQTT subscriptions active"
                    );

                }

            }
        );

    });

    // ==================================================
    // RECONNECT
    // ==================================================

    mqttClient.on("reconnect", () => {

        console.log(
            "Reconnecting to MQTT broker..."
        );

    });

    // ==================================================
    // ERROR
    // ==================================================

    mqttClient.on("error", (err) => {

        console.error(
            "MQTT Error:",
            err.message
        );

    });

    // ==================================================
    // CLOSE
    // ==================================================

    mqttClient.on("close", () => {

        console.log(
            "MQTT connection closed"
        );

    });

    // ==================================================
    // MESSAGE RECEIVED
    // ==================================================

    mqttClient.on(
        "message",
        async (topic, payload) => {

            const payloadStr =
                payload.toString();

            console.log(
                `MQTT message received: ${topic}`
            );

            try {

                const data =
                    JSON.parse(payloadStr);

                // --------------------------------------
                // PATIENT VITALS
                // --------------------------------------

                if (
                    topic.startsWith(
                        "lifeguard/patient/"
                    ) &&
                    topic.endsWith("/vitals")
                ) {

                    const parts =
                        topic.split("/");

                    const patientId =
                        parts[2];

                    await handlePatientVitalsMQTT(
                        patientId,
                        data
                    );

                }

                // --------------------------------------
                // ROOM ENVIRONMENT
                // --------------------------------------

                else if (
                    topic.startsWith(
                        "lifeguard/room/"
                    ) &&
                    topic.endsWith("/environment")
                ) {

                    const parts =
                        topic.split("/");

                    const roomId =
                        parts[2];

                    await handleRoomEnvironmentMQTT(
                        roomId,
                        data
                    );

                }

            } catch (err) {

                console.error(
                    "MQTT Message Processing Error:",
                    err.message
                );

            }

        }
    );
}


// ======================================================
// HANDLE PATIENT VITALS
// ======================================================

async function handlePatientVitalsMQTT(
    patientId,
    data
) {

    const {
        heartRate,
        spo2,
        temperature,
        fingerDetected
    } = data;

    let roomContext = {};

    // ==================================================
    // MONGODB PATH
    // ==================================================

    if (
        mongoose.connection.readyState === 1
    ) {

        const patient =
            await Patient.findOne({
                patientId
            });

        if (patient) {

            // ------------------------------------------
            // FIND PATIENT ROOM
            // ------------------------------------------

            const room =
                await Room.findOne({
                    roomId: patient.room
                });

            if (room) {

                roomContext = {

                    temperature:
                        room.temperature,

                    humidity:
                        room.humidity,

                    airQuality:
                        room.airQuality,

                    presenceDetected:
                        room.presenceDetected

                };

            }

            // ------------------------------------------
            // AI RISK PREDICTION
            // ------------------------------------------

            const riskResult =
                await calculateRiskWithAI(
                    {
                        heartRate,
                        spo2,
                        temperature
                    },
                    roomContext
                );

            // ------------------------------------------
            // UPDATE PATIENT
            // ------------------------------------------

            patient.heartRate =
                heartRate;

            patient.spo2 =
                spo2;

            patient.temperature =
                temperature;

            patient.risk =
                riskResult.risk;

            patient.riskScore =
                riskResult.riskScore;

            patient.riskReasons =
                riskResult.riskReasons;

            patient.riskSummary =
                riskResult.riskSummary;

            patient.recommendedAction =
                riskResult.recommendedAction;

            patient.roomContext =
                roomContext;

            await patient.save();


            // ==================================================
            // SAVE VITAL HISTORY
            // ==================================================

            await Vital.create({

                patientId:
                    patient.patientId,

                room:
                    patient.room,

                heartRate,

                spo2,

                temperature,

                risk:
                    riskResult.risk,

                riskScore:
                    riskResult.riskScore,

                riskReasons:
                    riskResult.riskReasons,

                riskSummary:
                    riskResult.riskSummary,

                recommendedAction:
                    riskResult.recommendedAction

            });


            // ==================================================
            // ALERT MANAGEMENT
            // ==================================================

            if (
                riskResult.risk === "HIGH" ||
                riskResult.risk === "MODERATE"
            ) {

                // ------------------------------------------
                // CHECK EXISTING ACTIVE ALERT
                // ------------------------------------------

                const existingAlert =
                    await Alert.findOne({

                        patientId:
                            patient.patientId,

                        status:
                            "ACTIVE"

                    });


                if (existingAlert) {

                    // --------------------------------------
                    // UPDATE EXISTING ALERT
                    // --------------------------------------

                    existingAlert.risk =
                        riskResult.risk;

                    existingAlert.riskScore =
                        riskResult.riskScore;

                    existingAlert.reasons =
                        riskResult.riskReasons;

                    existingAlert.summary =
                        riskResult.riskSummary;

                    existingAlert.recommendedAction =
                        riskResult.recommendedAction;

                    existingAlert.room =
                        patient.room;

                    await existingAlert.save();

                } else {

                    // --------------------------------------
                    // CREATE NEW ALERT
                    // --------------------------------------

                    await Alert.create({

                        patientId:
                            patient.patientId,

                        patientName:
                            patient.name,

                        room:
                            patient.room,

                        risk:
                            riskResult.risk,

                        riskScore:
                            riskResult.riskScore,

                        reasons:
                            riskResult.riskReasons,

                        summary:
                            riskResult.riskSummary,

                        recommendedAction:
                            riskResult.recommendedAction,

                        status:
                            "ACTIVE"

                    });

                }

            } else {

                // ------------------------------------------
                // LOW RISK → RESOLVE ACTIVE ALERT
                // ------------------------------------------

                await Alert.updateMany(

                    {
                        patientId:
                            patient.patientId,

                        status:
                            "ACTIVE"
                    },

                    {
                        status:
                            "RESOLVED",

                        resolvedAt:
                            new Date()
                    }

                );

            }


            // ==================================================
            // LOG
            // ==================================================

            console.log(

                `[MQTT Ingest DB] Patient ${patientId}: ` +

                `HR=${heartRate}, ` +

                `SpO2=${spo2}%, ` +

                `Temp=${temperature}°C ` +

                `-> AI Risk: ${riskResult.risk}`

            );


            // ==================================================
            // ROOM ACTUATION
            // ==================================================

            // ------------------------------------------
            // HEART-RATE PHYSICAL ALERT
            // ------------------------------------------
            // Alarm only when a finger is actually detected.
            // HR = 0 / invalid must never trigger the alarm.
            const heartRateAlert =
                fingerDetected === true &&
                heartRate > 0 &&
                (heartRate > 130 || heartRate < 60);

            const roomAction = {
                fan: riskResult.recommendedAction?.fan === true,
                buzzer: heartRateAlert,
                led: heartRateAlert,
                reason: heartRateAlert
                    ? `Abnormal heart rate detected: ${heartRate} BPM`
                    : (fingerDetected === true
                        ? "Heart rate within physical alert limits."
                        : "Finger not detected. Physical alert disabled.")
            };

            publishRoomControlMQTT(
                patient.room,
                roomAction
            );

            return;

        }

    }


    // ==================================================
    // FALLBACK MEMORY PATH
    // ==================================================

    const memPatient =
        fallbackPatients.find(
            p =>
                p.patientId === patientId
        );


    if (memPatient) {

        memPatient.heartRate =
            heartRate;

        memPatient.spo2 =
            spo2;

        memPatient.temperature =
            temperature;

        roomContext =
            memPatient.roomContext || {};


        const riskResult =
            await calculateRiskWithAI(

                {
                    heartRate,
                    spo2,
                    temperature
                },

                roomContext

            );


        memPatient.risk =
            riskResult.risk;

        memPatient.riskScore =
            riskResult.riskScore;

        memPatient.riskReasons =
            riskResult.riskReasons;

        memPatient.riskSummary =
            riskResult.riskSummary;

        memPatient.recommendedAction =
            riskResult.recommendedAction;


        console.log(

            `[MQTT Ingest Mem] Patient ${patientId}: ` +

            `HR=${heartRate}, ` +

            `SpO2=${spo2}%, ` +

            `Temp=${temperature}°C ` +

            `-> AI Risk: ${riskResult.risk}`

        );


        // ------------------------------------------
        // HEART-RATE PHYSICAL ALERT
        // ------------------------------------------
        const heartRateAlert =
            fingerDetected === true &&
            heartRate > 0 &&
            (heartRate > 130 || heartRate < 60);

        const roomAction = {
            fan: riskResult.recommendedAction?.fan === true,
            buzzer: heartRateAlert,
            led: heartRateAlert,
            reason: heartRateAlert
                ? `Abnormal heart rate detected: ${heartRate} BPM`
                : (fingerDetected === true
                    ? "Heart rate within physical alert limits."
                    : "Finger not detected. Physical alert disabled.")
        };

        publishRoomControlMQTT(
            memPatient.room,
            roomAction
        );

    } else {

        console.log(

            `Patient ${patientId} not found in DB or fallback data`

        );

    }

}


// ======================================================
// HANDLE ROOM ENVIRONMENT
// ======================================================

async function handleRoomEnvironmentMQTT(
    roomId,
    data
) {

    const {
        temperature,
        humidity,
        airQuality,
        presenceDetected
    } = data;


    // ==================================================
    // UPDATE MONGODB
    // ==================================================

    if (
        mongoose.connection.readyState === 1
    ) {

        await Room.findOneAndUpdate(

            {
                roomId
            },

            {

                temperature,

                humidity,

                airQuality,

                presenceDetected,

                lastUpdated:
                    new Date()

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


    // ==================================================
    // UPDATE FALLBACK ROOM
    // ==================================================

    const memRoom =
        fallbackRooms.find(
            r =>
                r.roomId === roomId
        );


    if (memRoom) {

        memRoom.temperature =
            temperature;

        memRoom.humidity =
            humidity;

        memRoom.airQuality =
            airQuality;

        memRoom.presenceDetected =
            presenceDetected;

    }


    // ==================================================
    // UPDATE PATIENT ROOM CONTEXT
    // ==================================================

    fallbackPatients

        .filter(
            p =>
                p.room === roomId
        )

        .forEach(
            p => {

                p.roomContext = {

                    temperature,

                    humidity,

                    airQuality,

                    presenceDetected

                };

            }
        );


    console.log(

        `[MQTT Ingest Mem] Room ${roomId}: ` +

        `Temp=${temperature}°C, ` +

        `Humidity=${humidity}%, ` +

        `AirQuality=${airQuality}`

    );

}


// ======================================================
// PUBLISH ROOM CONTROL
// ======================================================

function publishRoomControlMQTT(
    roomId,
    action
) {

    if (
        !mqttClient ||
        !mqttClient.connected
    ) {

        console.log(
            "MQTT not connected. Control command not sent."
        );

        return;

    }


    const controlTopic =
        `lifeguard/room/${roomId}/control`;


    const payload =
        JSON.stringify(action);


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
                `Buzzer=${action.buzzer ? "ON" : "OFF"}, ` +
                `LED=${action.led ? "ON" : "OFF"}`

            );

        }

    );

}


// ======================================================
// EXPORTS
// ======================================================

module.exports = {

    startMQTTBroker,

    publishRoomControlMQTT  

};