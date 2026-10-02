const mqtt = require("mqtt");

const BROKER_URL = "mqtt://10.222.14.64:1883";
const TOPIC = "lifeguard/patient/P003/vitals";

const client = mqtt.connect(BROKER_URL, {
    clientId: "lifeguard-test-publisher",
    reconnectPeriod: 5000
});

client.on("connect", () => {
    console.log(`MQTT connected to ${BROKER_URL}`);

    const message = {
        patient_id: "P003",
        heartRate: 135,
        spo2: 98,
        temperature: 36.5,
        heartRateStatus: "HIGH",
        spo2Status: "NORMAL",
        fingerDetected: true
    };

    client.publish(
        TOPIC,
        JSON.stringify(message),
        { qos: 0, retain: false },
        (err) => {
            if (err) {
                console.error("MQTT publish failed:", err.message);
                client.end();
                return;
            }

            console.log(`TEST MESSAGE PUBLISHED to ${TOPIC}`);
            console.log(JSON.stringify(message, null, 2));
            client.end();
        }
    );
});

client.on("error", (err) => {
    console.error("MQTT connection error:", err.message);
});

client.on("close", () => {
    console.log("MQTT connection closed.");
});

client.on("offline", () => {
    console.warn("MQTT client is offline.");
});
