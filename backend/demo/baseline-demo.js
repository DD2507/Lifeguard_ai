const mqtt = require("mqtt");

const client = mqtt.connect(
    process.env.MQTT_BROKER_URL ||
    process.env.MQTT_URL ||
    "mqtt://10.222.14.64:1883"
);

const patientId = process.argv[2] || process.env.BASELINE_DEMO_PATIENT_ID;

if (!patientId) {
    console.error(
        "Usage: node backend/demo/baseline-demo.js <existing-patient-id>"
    );
    process.exit(1);
}

const topic =
    `lifeguard/patient/${patientId}/vitals`;

const normalReadings = [
    { heartRate: 78, spo2: 97, temperature: 36.8 },
    { heartRate: 79, spo2: 98, temperature: 36.8 },
    { heartRate: 77, spo2: 97, temperature: 36.7 },
    { heartRate: 80, spo2: 97, temperature: 36.8 },
    { heartRate: 78, spo2: 98, temperature: 36.8 },
    { heartRate: 79, spo2: 97, temperature: 36.9 },
    { heartRate: 77, spo2: 97, temperature: 36.8 },
    { heartRate: 78, spo2: 98, temperature: 36.8 },
    { heartRate: 80, spo2: 97, temperature: 36.8 },
    { heartRate: 79, spo2: 97, temperature: 36.8 }
];

client.on("connect", () => {
    void verifyPatientAndPublish();
});

async function verifyPatientAndPublish() {
    const apiBaseUrl = process.env.API_BASE_URL || "http://localhost:5000/api";
    try {
        const response = await fetch(
            `${apiBaseUrl}/patients/${encodeURIComponent(patientId)}`
        );
        if (!response.ok) {
            throw new Error(
                `Patient ${patientId} is not registered (API returned ${response.status}); refusing to publish baseline readings`
            );
        }
        console.log(`Starting baseline simulation for existing patient ${patientId}`);
    } catch (error) {
        console.error("Baseline demo stopped:", error.message);
        client.end();
        return;
    }

    let index = 0;

    const interval = setInterval(() => {
        const reading =
            normalReadings[index];

        client.publish(
            topic,
            JSON.stringify(reading),
            (error) => {
                if (error) {
                    console.error(
                        "Publish failed:",
                        error.message
                    );
                    return;
                }

                console.log(
                    `Sample ${index + 1}/10 →`,
                    reading
                );
            }
        );

        index++;

        if (
            index >=
            normalReadings.length
        ) {
            clearInterval(interval);

            setTimeout(() => {
                client.end();
                console.log(
                    "Baseline simulation complete"
                );
            }, 1000);
        }
    }, 1000);
}

client.on("error", (error) => {
    console.error(
        "MQTT error:",
        error.message
    );
});