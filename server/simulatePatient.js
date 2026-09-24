const mqtt = require("mqtt");

const MQTT_URL = "mqtt://127.0.0.1:1883";
const TOPIC = "lifeguard/patient/P003/vitals";

const client = mqtt.connect(MQTT_URL, {
    protocolVersion: 4
});

const readings = [
    {
        heartRate: 72,
        spo2: 98,
        temperature: 36.7
    },
    {
        heartRate: 78,
        spo2: 97,
        temperature: 36.9
    },
    {
        heartRate: 92,
        spo2: 95,
        temperature: 37.2
    },
    {
        heartRate: 105,
        spo2: 93,
        temperature: 37.8
    },
    {
        heartRate: 125,
        spo2: 88,
        temperature: 39.2
    },
    {
        heartRate: 110,
        spo2: 91,
        temperature: 38.5
    },
    {
        heartRate: 88,
        spo2: 95,
        temperature: 37.4
    },
    {
        heartRate: 75,
        spo2: 98,
        temperature: 36.8
    }
];

let index = 0;

client.on("connect", () => {
    console.log("=================================");
    console.log("LifeGuard AI Patient Simulator");
    console.log("Patient: P003");
    console.log("MQTT: Connected");
    console.log("=================================");

    sendReading();

    setInterval(sendReading, 3000);
});

client.on("error", (err) => {
    console.error("MQTT Error:", err.message);
});

function sendReading() {
    const reading = readings[index];

    const payload = {
        heartRate: reading.heartRate,
        spo2: reading.spo2,
        temperature: reading.temperature
    };

    client.publish(
        TOPIC,
        JSON.stringify(payload),
        { qos: 0 },
        (err) => {
            if (err) {
                console.error("Publish error:", err.message);
                return;
            }

            console.log(
                `[SIMULATOR] P003 -> HR=${reading.heartRate} BPM | ` +
                `SpO2=${reading.spo2}% | ` +
                `Temp=${reading.temperature}°C`
            );
        }
    );

    index = (index + 1) % readings.length;
}