const mqtt = require("mqtt");

const client = mqtt.connect(
    process.env.MQTT_BROKER_URL ||
    "mqtt://localhost:1883"
);

const patientId = "P001";

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
    console.log(
        `Starting baseline simulation for ${patientId}`
    );

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
});

client.on("error", (error) => {
    console.error(
        "MQTT error:",
        error.message
    );
});