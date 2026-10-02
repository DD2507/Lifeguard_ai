const mqtt = require("mqtt");

const MQTT_URL = "mqtt://10.222.14.64:1883";
const TOPIC = "lifeguard/patient/P003/vitals";
const CONTROL_TOPIC = "lifeguard/demo/P003/control";

const client = mqtt.connect(MQTT_URL);

// ===============================
// HIGH-RISK DEMO DATA
// ===============================
const highRiskMessage = {
    patient_id: "P003",
    demoSource: "server/demo_high_risk",
    demoMode: "ACTIVE",
    heartRate: 135,
    spo2: 98,
    temperature: 36.5,
    heartRateStatus: "HIGH",
    spo2Status: "NORMAL",
    fingerDetected: true
};

// ===============================
// NORMAL DATA TO RESTORE PATIENT
// ===============================
const normalMessage = {
    patient_id: "P003",
    demoSource: "server/demo_high_risk",
    demoMode: "STOP",
    heartRate: 75,
    spo2: 98,
    temperature: 36.7,
    heartRateStatus: "NORMAL",
    spo2Status: "NORMAL",
    fingerDetected: true
};

let interval;
let stopping = false;

// ===============================
// CONNECT
// ===============================
client.on("connect", () => {

    console.log("=================================");
    console.log("LifeGuard AI - HIGH RISK DEMO");
    console.log("Patient: P003");
    console.log("MQTT: Connected");
    console.log("=================================");

    client.subscribe(CONTROL_TOPIC, { qos: 1 }, (error) => {
        if (error) {
            console.error("Failed to subscribe to demo control:", error.message);
            return;
        }
        console.log("Acknowledge-control: Ready");

        // Send first high-risk reading
        publishHighRisk();

        // Continue every 3 seconds
        interval = setInterval(publishHighRisk, 3000);
    });
});

client.on("message", (topic, payload) => {
    if (topic !== CONTROL_TOPIC) return;
    try {
        const command = JSON.parse(payload.toString());
        if (command.action === "STOP_HIGH_RISK_DEMO") {
            stopDemo("Alert acknowledged from the dashboard");
        }
    } catch (error) {
        console.error("Invalid demo-control message:", error.message);
    }
});

// ===============================
// HIGH-RISK PUBLISH
// ===============================
function publishHighRisk() {

    client.publish(
        TOPIC,
        JSON.stringify(highRiskMessage),
        { qos: 0 },
        (err) => {

            if (err) {
                console.error("Publish error:", err.message);
                return;
            }

            console.log(
                `[HIGH RISK DEMO] P003 -> ` +
                `HR=${highRiskMessage.heartRate} BPM | ` +
                `SpO2=${highRiskMessage.spo2}% | ` +
                `Temp=${highRiskMessage.temperature}°C`
            );
        }
    );
}

// ===============================
// CTRL + C
// RESTORE NORMAL CONDITION
// ===============================
function stopDemo(reason) {
    if (stopping) return;
    stopping = true;

    console.log();
    console.log("=================================");
    console.log("Stopping HIGH RISK DEMO...");
    console.log(`Reason: ${reason}`);
    console.log("Restoring normal patient data...");
    console.log("=================================");

    // Stop high-risk publishing
    clearInterval(interval);

    // Send normal reading
    client.publish(
        TOPIC,
        JSON.stringify(normalMessage),
        { qos: 0 },
        (err) => {

            if (err) {
                console.error(
                    "Failed to publish normal reading:",
                    err.message
                );
            } else {

                console.log(
                    `[NORMAL] P003 -> ` +
                    `HR=${normalMessage.heartRate} BPM | ` +
                    `SpO2=${normalMessage.spo2}% | ` +
                    `Temp=${normalMessage.temperature}°C`
                );

                console.log("Patient restored to NORMAL.");
            }

            // Give MQTT time to send the message
            setTimeout(() => {
                client.end();
                console.log("MQTT disconnected.");
                process.exit(0);
            }, 500);
        }
    );
}

process.on("SIGINT", () => stopDemo("Ctrl+C"));

// ===============================
// MQTT ERROR
// ===============================
client.on("error", (err) => {
    console.error("MQTT Error:", err.message);
});
