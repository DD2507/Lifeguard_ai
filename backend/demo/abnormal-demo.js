const mqtt = require("mqtt");

const client = mqtt.connect(
    process.env.MQTT_BROKER_URL ||
    "mqtt://localhost:1883"
);

const patientId = "P001";

const topic =
    `lifeguard/patient/${patientId}/vitals`;

const abnormalReadings = [
    {
        heartRate: 82,
        spo2: 97,
        temperature: 36.9
    },
    {
        heartRate: 87,
        spo2: 96,
        temperature: 37.2
    },
    {
        heartRate: 92,
        spo2: 95,
        temperature: 37.5
    },
    {
        heartRate: 98,
        spo2: 93,
        temperature: 38.0
    },
    {
        heartRate: 105,
        spo2: 92,
        temperature: 38.2
    }
];

client.on("connect", () => {
    console.log(
        `Starting abnormal simulation for ${patientId}`
    );

    let index = 0;

    const interval = setInterval(() => {
        const reading =
            abnormalReadings[index];

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
                    `Abnormal sample ${index + 1}/${abnormalReadings.length} →`,
                    reading
                );
            }
        );

        index++;

        if (
            index >=
            abnormalReadings.length
        ) {
            clearInterval(interval);

            setTimeout(() => {
                client.end();

                console.log(
                    "Abnormal simulation complete"
                );
            }, 1000);
        }
    }, 1500);
});

client.on("error", (error) => {
    console.error(
        "MQTT error:",
        error.message
    );
});