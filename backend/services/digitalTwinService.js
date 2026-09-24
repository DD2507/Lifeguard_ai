const { BASELINE_SAMPLE_COUNT } = require('./baselineService');

const SCENARIO_LIBRARY = {
  REDUCED_OXYGEN: {
    id: 'REDUCED_OXYGEN',
    name: 'Reduced Oxygen',
    description: 'Simulated oxygen decline with a mild heart-rate rise to reflect a lower SpO₂ condition.',
    apply: (state) => ({
      spo2: Number(Math.max(70, state.spo2 - 6).toFixed(1)),
      heartRate: Number(Math.min(150, state.heartRate + 13).toFixed(1))
    })
  },

  FEVER_LIKE: {
    id: 'FEVER_LIKE',
    name: 'Fever-Like',
    description: 'Simulated temperature rise with a modest increase in heart rate to represent an inflammatory stress pattern.',
    apply: (state) => ({
      temperature: Number((state.temperature + 1.3).toFixed(1)),
      heartRate: Number(Math.min(150, state.heartRate + 8).toFixed(1))
    })
  },

  ELEVATED_HEART_RATE: {
    id: 'ELEVATED_HEART_RATE',
    name: 'Elevated Heart Rate',
    description: 'Simulated tachycardia without changing oxygen or temperature values.',
    apply: (state) => ({
      heartRate: Number(Math.min(150, state.heartRate + 18).toFixed(1))
    })
  },

  COMBINED_DETERIORATION: {
    id: 'COMBINED_DETERIORATION',
    name: 'Combined Deterioration',
    description: 'A broader stress scenario combining reduced oxygenation, elevated heart rate, and a mild temperature increase.',
    apply: (state) => ({
      heartRate: Number(Math.min(150, state.heartRate + 14).toFixed(1)),
      spo2: Number(Math.max(70, state.spo2 - 5).toFixed(1)),
      temperature: Number((state.temperature + 0.9).toFixed(1))
    })
  },

  POOR_ROOM_ENVIRONMENT: {
    id: 'POOR_ROOM_ENVIRONMENT',
    name: 'Poor Room Environment',
    description: 'A simulated room environment deterioration that increases thermal and air-quality stress.',
    apply: (state) => ({
      roomTemperature: Number((state.roomTemperature + 8).toFixed(1)),
      humidity: Number(Math.min(100, state.humidity + 18).toFixed(1)),
      airQuality: Number(Math.min(300, state.airQuality + 55).toFixed(1))
    })
  }
};

function normalizeNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function resolveScenario(scenarioId) {
  if (!scenarioId) {
    return null;
  }

  const key = String(scenarioId).toUpperCase();
  return SCENARIO_LIBRARY[key] || null;
}

function buildScenarioState(scenarioId, currentState = {}, baseline = {}) {
  const scenario = resolveScenario(scenarioId);

  if (!scenario) {
    throw new Error('Unknown scenario');
  }

  const state = {
    heartRate: normalizeNumber(currentState.heartRate, baseline.heartRate ?? 0),
    spo2: normalizeNumber(currentState.spo2, baseline.spo2 ?? 100),
    temperature: normalizeNumber(currentState.temperature, baseline.temperature ?? 36.8),
    roomTemperature: normalizeNumber(currentState.roomTemperature, 24),
    humidity: normalizeNumber(currentState.humidity, 50),
    airQuality: normalizeNumber(currentState.airQuality, 100)
  };

  const scenarioState = scenario.apply(state, baseline);

  return {
    ...state,
    ...scenarioState
  };
}

function calculateTrend(values, metricKey = 'heartRate') {
  const numericValues = values
    .map((value) => normalizeNumber(value, Number.NaN))
    .filter((value) => Number.isFinite(value) && value > 0);

  if (numericValues.length < 2) {
    return {
      label: 'INSUFFICIENT_DATA',
      direction: 'n/a',
      average: null,
      oldest: null,
      latest: null,
      delta: 0,
      sampleCount: numericValues.length
    };
  }

  const oldest = numericValues[0];
  const latest = numericValues[numericValues.length - 1];
  const delta = latest - oldest;
  const average =
    numericValues.reduce((sum, value) => sum + value, 0) /
    numericValues.length;

  let label = 'STABLE';
  let direction = 'flat';

  if (Math.abs(delta) <= 0.5) {
    label = 'STABLE';
    direction = 'flat';
  } else if (delta > 0) {
    label = 'RISING';
    direction = 'up';
  } else {
    label = 'FALLING';
    direction = 'down';
  }

  return {
    label,
    direction,
    average: Number(average.toFixed(2)),
    oldest: Number(oldest.toFixed(2)),
    latest: Number(latest.toFixed(2)),
    delta: Number(delta.toFixed(2)),
    sampleCount: numericValues.length,
    metricKey
  };
}

function computeBaselineFromHistory(history = []) {
  const validHistory = history
    .filter((entry) =>
      entry &&
      Number.isFinite(Number(entry.heartRate)) &&
      Number(entry.heartRate) > 0 &&
      Number.isFinite(Number(entry.spo2)) &&
      Number(entry.spo2) > 0 &&
      Number.isFinite(Number(entry.temperature)) &&
      Number(entry.temperature) > 0
    )
    .slice(0, BASELINE_SAMPLE_COUNT)
    .reverse();

  if (validHistory.length < 3) {
    return {
      status: 'INSUFFICIENT_HISTORY',
      message:
        'This patient does not yet have enough valid historical readings to establish a personal baseline.',
      sampleCount: validHistory.length,
      requiredSamples: BASELINE_SAMPLE_COUNT,
      baseline: {
        heartRate: null,
        spo2: null,
        temperature: null
      }
    };
  }

  const heartRate =
    validHistory.reduce(
      (sum, entry) => sum + Number(entry.heartRate),
      0
    ) / validHistory.length;

  const spo2 =
    validHistory.reduce(
      (sum, entry) => sum + Number(entry.spo2),
      0
    ) / validHistory.length;

  const temperature =
    validHistory.reduce(
      (sum, entry) => sum + Number(entry.temperature),
      0
    ) / validHistory.length;

  return {
    status: 'SUFFICIENT',
    message: 'Personal baseline calculated from recent valid readings for this patient.',
    sampleCount: validHistory.length,
    requiredSamples: BASELINE_SAMPLE_COUNT,
    baseline: {
      heartRate: Number(heartRate.toFixed(2)),
      spo2: Number(spo2.toFixed(2)),
      temperature: Number(temperature.toFixed(2))
    }
  };
}

function assembleDigitalTwinSummary({
  patient,
  currentState,
  baseline,
  deviations,
  trends,
  dataQuality
}) {
  return {
    patient: {
      patientId: patient?.patientId,
      name: patient?.name,
      room: patient?.room,
      risk: patient?.risk,
      riskScore: patient?.riskScore,
      source: patient?.source || 'Live monitoring'
    },
    currentState,
    baseline,
    deviations,
    trends,
    dataQuality,
    simulationOnly: false,
    note: 'This patient-specific view is derived from the real patient record and recent vitals only.'
  };
}

module.exports = {
  SCENARIO_LIBRARY,
  buildScenarioState,
  calculateTrend,
  computeBaselineFromHistory,
  assembleDigitalTwinSummary,
  normalizeNumber,
  resolveScenario
};