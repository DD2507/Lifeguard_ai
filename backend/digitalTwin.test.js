const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildScenarioState,
  calculateTrend,
  assembleDigitalTwinSummary,
} = require('./services/digitalTwinService');

test('buildScenarioState applies reduced oxygen scenario values', () => {
  const currentState = {
    heartRate: 82,
    spo2: 98,
    temperature: 36.8,
    roomTemperature: 24,
    humidity: 50,
    airQuality: 85,
  };

  const nextState = buildScenarioState('REDUCED_OXYGEN', currentState, {
    heartRate: 78,
    spo2: 99,
    temperature: 36.7,
  });

  assert.equal(nextState.spo2, 92);
  assert.equal(nextState.heartRate, 95);
  assert.equal(nextState.roomTemperature, 24);
});

test('calculateTrend reports a falling trend for decreasing values', () => {
  const trend = calculateTrend([98, 96, 94, 92], 'spo2');

  assert.equal(trend.label, 'FALLING');
  assert.equal(trend.direction, 'down');
});

test('assembleDigitalTwinSummary returns overall patient digital twin structure', () => {
  const summary = assembleDigitalTwinSummary({
    patient: { patientId: 'P003', name: 'Alice', room: 'R101' },
    currentState: { heartRate: 82, spo2: 98, temperature: 36.8 },
    baseline: { heartRate: 78, spo2: 99, temperature: 36.7 },
    deviations: { heartRate: 4, spo2: -1, temperature: 0.1 },
    trends: { heartRate: { label: 'STABLE' }, spo2: { label: 'FALLING' } },
    dataQuality: { status: 'SUFFICIENT' },
  });

  assert.equal(summary.patient.patientId, 'P003');
  assert.equal(summary.dataQuality.status, 'SUFFICIENT');
  assert.equal(summary.currentState.heartRate, 82);
});
