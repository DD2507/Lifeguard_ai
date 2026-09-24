const mqtt = require("mqtt");

const client = mqtt.connect("mqtt://10.52.146.64:1883");

client.on("connect", () => {
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
        "lifeguard/patient/P003/vitals",
        JSON.stringify(message),
        {},
        () => {
            console.log("TEST MESSAGE PUBLISHED");
            client.end();
        }
    );
});
