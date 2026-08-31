const { calculateRisk } = require("./services/riskEngine");

const vitals = {
    heartRate: 108,
    spo2: 92,
    temperature: 38.2
};

const roomContext = {
    temperature: 32,
    humidity: 78,
    airQuality: 220,
    presenceDetected: true
};

const result = calculateRisk(vitals, roomContext);

console.log(JSON.stringify(result, null, 2));