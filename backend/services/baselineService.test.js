const test = require("node:test");
const assert = require("node:assert/strict");

const {
    BASELINE_SAMPLE_COUNT,
    validateReading,
    isNormalBaselineReading,
    calculateBaseline,
    calculateDeviation,
    isValidBaseline,
    isPersistedBaseline
} = require("./baselineService");

const reading = (heartRate, spo2 = 97, temperature = 36.7) => ({
    heartRate,
    spo2,
    temperature
});

test("accepts finite live values and rejects missing, zero, out-of-range, or no-contact samples", () => {
    assert.equal(validateReading(reading(80)).valid, true);
    assert.equal(validateReading(reading(0)).valid, false);
    assert.equal(validateReading({ ...reading(80), spo2: 0 }).valid, false);
    assert.equal(validateReading({ ...reading(80), temperature: 85 }).valid, false);
    assert.equal(validateReading({ ...reading(80), fingerDetected: false }).valid, false);
    assert.equal(validateReading({ ...reading(80), heartRateStatus: "INVALID" }).valid, false);
    assert.equal(validateReading({ ...reading(80), spo2Status: "invalid" }).valid, false);
    assert.equal(validateReading({ heartRate: 80, spo2: 97 }).valid, false);
});

test("calculates a robust per-metric median from the configured calibration window", () => {
    const samples = Array.from({ length: BASELINE_SAMPLE_COUNT }, (_, index) =>
        reading(index === 0 ? 200 : 80 + (index % 2), 97, 36.7)
    );
    const baseline = calculateBaseline(samples);

    assert.deepEqual(baseline, {
        heartRate: 81,
        spo2: 97,
        temperature: 36.7
    });
});

test("does not establish a baseline before enough valid samples are collected", () => {
    assert.equal(calculateBaseline(Array(BASELINE_SAMPLE_COUNT - 1).fill(reading(80))), null);
    assert.equal(calculateBaseline([
        ...Array(BASELINE_SAMPLE_COUNT - 1).fill(reading(80)),
        reading(80, 0)
    ]), null);
});

test("validates persisted baselines and calculates signed live deviations", () => {
    const baseline = { heartRate: 80, spo2: 97, temperature: 36.7 };
    assert.equal(isValidBaseline(baseline), true);
    assert.equal(isValidBaseline({ ...baseline, heartRate: 0 }), false);
    assert.deepEqual(calculateDeviation(reading(92, 94, 38), {
        ...baseline,
        established: true
    }), {
        heartRate: 12,
        spo2: -3,
        temperature: 1.3
    });
});

test("does not trust plausible legacy values without a persisted MQTT calibration window", () => {
    const baseline = { heartRate: 80, spo2: 97, temperature: 36.7, established: true };
    assert.equal(isValidBaseline(baseline), true);
    assert.equal(isPersistedBaseline(baseline), false);

    const calibrationSamples = Array.from(
        { length: BASELINE_SAMPLE_COUNT },
        () => ({ ...reading(80), receivedAt: new Date() })
    );
    assert.equal(isPersistedBaseline({
        ...baseline,
        calibrationStatus: "ESTABLISHED",
        establishedAt: new Date(),
        calibrationSamples
    }), true);
});

test("accepts 34°C through 35°C as normal prototype temperature samples", () => {
    assert.equal(isNormalBaselineReading(reading(80, 97, 34)), true);
    assert.equal(isNormalBaselineReading(reading(80, 97, 34.9)), true);
    assert.equal(isNormalBaselineReading(reading(80, 97, 35)), true);
    assert.equal(isNormalBaselineReading(reading(80, 97, 33.9)), false);
});

test("calculates and validates a persisted arithmetic-mean session baseline", () => {
    const calibrationSamples = Array.from({ length: BASELINE_SAMPLE_COUNT }, (_, index) => ({
        ...reading(80 + index, 96 + (index % 3), 36.5 + (index % 2) * 0.2),
        receivedAt: new Date(Date.UTC(2026, 0, 1, 0, index))
    }));
    const baseline = calculateBaseline(calibrationSamples, "mean");

    assert.deepEqual(baseline, {
        heartRate: 87,
        spo2: 97,
        temperature: 36.59
    });
    assert.equal(isPersistedBaseline({
        ...baseline,
        sampleCount: calibrationSamples.length,
        calibrationStatus: "ESTABLISHED",
        calibrationSamples,
        establishedAt: new Date(),
        baselineMethod: "mean",
        established: true
    }), true);
    assert.equal(calculateBaseline(calibrationSamples, "unsupported"), null);
});
