const test = require("node:test");
const assert = require("node:assert/strict");

const { calculateBaselineSimulationRisk } = require("./baselineSimulationRisk");

const baseline = { heartRate: 89.33, spo2: 100, temperature: 34.81 };

test("keeps readings close to the saved personal baseline at LOW risk", () => {
    const result = calculateBaselineSimulationRisk(
        { heartRate: 90, spo2: 99, temperature: 34 },
        baseline
    );

    assert.equal(result.risk, "LOW");
    assert.equal(result.riskScore, 0);
    assert.deepEqual(result.riskReasons, []);
    assert.deepEqual(result.deviations, {
        heartRate: 0.67,
        spo2: -1,
        temperature: -0.81
    });
});

test("scores only material deviations from the saved personal baseline", () => {
    const moderate = calculateBaselineSimulationRisk(
        { heartRate: 105, spo2: 100, temperature: 34.81 },
        baseline
    );
    assert.equal(moderate.risk, "MODERATE");
    assert.equal(moderate.riskScore, 0.3);
    assert.equal(moderate.riskReasons[0].factor, "Heart Rate Baseline Deviation");

    const high = calculateBaselineSimulationRisk(
        { heartRate: 90, spo2: 94, temperature: 34.81 },
        baseline
    );
    assert.equal(high.risk, "HIGH");
    assert.equal(high.riskScore, 0.6);
    assert.equal(high.riskReasons[0].factor, "SpO₂ Baseline Deviation");
});
