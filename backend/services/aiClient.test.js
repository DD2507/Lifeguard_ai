const test = require("node:test");
const assert = require("node:assert/strict");

const {
    MODEL_TRAINING_RANGES,
    getModelInputIssues,
    isWithinModelTrainingRanges
} = require("./aiClient");

const vitals = { heartRate: 80, spo2: 97, temperature: 36.7 };
const room = { temperature: 24, humidity: 50, airQuality: 100 };
const deviation = { heartRate: 0, spo2: 0, temperature: 0 };

test("matches the exact nine training features and accepts in-domain inference inputs", () => {
    assert.deepEqual(Object.keys(MODEL_TRAINING_RANGES), [
        "heartRate", "spo2", "temperature", "roomTemperature", "humidity",
        "airQuality", "hrDeviation", "spo2Deviation", "tempDeviation"
    ]);
    assert.equal(isWithinModelTrainingRanges(vitals, room, deviation), true);
});

test("skips inference if any actual reading or deviation is outside training ranges", () => {
    assert.equal(isWithinModelTrainingRanges({ ...vitals, temperature: 30.3 }, room, deviation), false);
    assert.equal(isWithinModelTrainingRanges(vitals, { ...room, temperature: null }, deviation), false);
    assert.equal(isWithinModelTrainingRanges(vitals, room, { ...deviation, heartRate: 41 }), false);
});

test("reports the exact model features outside range or missing", () => {
    const issues = getModelInputIssues(
        { ...vitals, temperature: 28.9 },
        { ...room, airQuality: 414 },
        deviation
    );

    assert.deepEqual(issues, [
        { feature: "temperature", value: 28.9, minimum: 35.5, maximum: 39.5, reason: "outside model training range" },
        { feature: "airQuality", value: 414, minimum: 50, maximum: 300, reason: "outside model training range" }
    ]);
    assert.equal(
        getModelInputIssues(vitals, { ...room, humidity: null }, deviation)[0].reason,
        "missing or non-numeric"
    );
});
