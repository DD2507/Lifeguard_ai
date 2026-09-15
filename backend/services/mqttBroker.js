const mqtt = require("mqtt");

const {
    processPatientVital
} = require("./patientVitalService");

const client = mqtt.connect(
    process.env.MQTT_BROKER_URL || "mqtt://localhost:1883"
);

const PATIENT_TOPIC = "lifeguard/patient/+/vitals";

function startMQTT() {
    client.on("connect", () => {
        console.log("MQTT connected");

        client.subscribe(PATIENT_TOPIC, (error) => {
            if (error) {
                console.error(
                    "MQTT subscription failed:",
                    error.message
                );
                return;
            }

            console.log(
                `Subscribed to ${PATIENT_TOPIC}`
            );
        });
    });

    client.on("error", (error) => {
        console.error(
            "MQTT error:",
            error.message
        );
    });

    client.on("message", async (topic, message) => {
        try {
            const match = topic.match(
                /^lifeguard\/patient\/([^/]+)\/vitals$/
            );

            if (!match) {
                return;
            }

            const patientId = match[1];

            const data =
                JSON.parse(message.toString());

            console.log(
                `MQTT reading → ${patientId}:`,
                data
            );

            const result =
                await processPatientVital(
                    patientId,
                    data
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
    mqttClient: client
};