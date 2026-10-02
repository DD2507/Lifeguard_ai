const test = require("node:test");
const assert = require("node:assert/strict");

const { calculateRisk } = require("./riskEngine");

test("does not flag accepted 34°C through 35°C prototype readings as temperature risk", () => {
    for (const temperature of [34, 34.9, 35]) {
        const result = calculateRisk(
            { heartRate: 80, spo2: 98, temperature },
            { temperature: 24, humidity: 50, airQuality: 100 },
            { heartRate: 0, spo2: 0, temperature: 0 }
        );
        assert.equal(
            result.riskReasons.some((reason) => reason.factor === "Temperature"),
            false
        );
    }
});

test("treats 22°C through 28°C as the normal room-temperature range", () => {
    for (const roomTemperature of [22, 24, 28]) {
        const result = calculateRisk(
            { heartRate: 80, spo2: 98, temperature: 35 },
            { temperature: roomTemperature, humidity: 50, airQuality: 100 },
            { heartRate: 0, spo2: 0, temperature: 0 }
        );
        assert.equal(
            result.riskReasons.some((reason) => reason.factor === "Room Temperature"),
            false
        );
        assert.equal(result.recommendedAction.fan, false);
    }

    for (const roomTemperature of [21.9, 28.1]) {
        const result = calculateRisk(
            { heartRate: 80, spo2: 98, temperature: 35 },
            { temperature: roomTemperature, humidity: 50, airQuality: 100 },
            { heartRate: 0, spo2: 0, temperature: 0 }
        );
        assert.equal(
            result.riskReasons.some((reason) => reason.factor === "Room Temperature"),
            true
        );
        assert.equal(result.recommendedAction.fan, true);
    }
});

test("explains a severe low temperature once and labels raw MQ135 accurately", () => {
    const result = calculateRisk(
        { heartRate: 99, spo2: 98, temperature: 30.4 },
        { temperature: 30.3, humidity: 57, airQuality: 433 },
        { heartRate: 0, spo2: 0, temperature: -1.86 }
    );

    assert.equal(result.risk, "HIGH");
    assert.equal(result.riskScore, 0.8);
    assert.equal(result.riskReasons.some(
        (reason) => reason.factor === "Temperature Baseline Deviation"
    ), false);
    assert.match(
        result.riskReasons.find((reason) => reason.factor === "Temperature").explanation,
        /verify sensor contact/
    );
    assert.match(
        result.riskReasons.find((reason) => reason.factor === "Air Quality").explanation,
        /not calibrated AQI/
    );
});
