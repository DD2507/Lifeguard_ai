const test = require("node:test");
const assert = require("node:assert/strict");
const { BASELINE_SAMPLE_COUNT } = require("./baselineService");

const patientId = "TEST-LIVE-BASELINE";
const baselineSamples = Array.from({ length: BASELINE_SAMPLE_COUNT }, () => ({
    heartRate: 80,
    spo2: 97,
    temperature: 36.7,
    receivedAt: new Date("2026-09-29T00:00:00.000Z")
}));

function makePatient({ established = false } = {}) {
    const baseline = {
        heartRate: established ? 80 : null,
        spo2: established ? 97 : null,
        temperature: established ? 36.7 : null,
        sampleCount: established ? BASELINE_SAMPLE_COUNT : 0,
        calibrationStatus: established ? "ESTABLISHED" : "BASELINE_CALIBRATING",
        calibrationSamples: established ? baselineSamples.map((sample) => ({ ...sample })) : [],
        establishedAt: established ? new Date("2026-09-29T00:00:00.000Z") : null,
        baselineMethod: "median",
        skippedAbnormalSamples: 0,
        established
    };

    return {
        patientId,
        name: "TEST patient",
        room: "TEST room",
        heartRate: null,
        spo2: null,
        temperature: null,
        fingerDetected: false,
        baseline,
        baselineDeviation: { heartRate: null, spo2: null, temperature: null },
        sensorStatus: "SENSOR_DISCONNECTED",
        lastSensorMessageAt: null,
        lastValidReadingAt: null,
        lastSensorError: "",
        heartRateAlertState: {
            consecutiveHighReadings: 0,
            lastHighHeartRate: null,
            notificationActive: false
        },
        aiRisk: null,
        aiConfidence: null,
        lastRiskAssessmentAt: null,
        risk: null,
        riskScore: null,
        riskReasons: [],
        riskSummary: "",
        recommendedAction: { fan: false, buzzer: false, reason: "" },
        roomContext: {},
        async save() {}
    };
}

const patientModelPath = require.resolve("../models/Patient");
const vitalModelPath = require.resolve("../models/Vital");
const roomModelPath = require.resolve("../models/room");
const alertModelPath = require.resolve("../models/Alert");
const notifierPath = require.resolve("./notificationService");
const originals = new Map([
    [patientModelPath, require.cache[patientModelPath]],
    [vitalModelPath, require.cache[vitalModelPath]],
    [roomModelPath, require.cache[roomModelPath]],
    [alertModelPath, require.cache[alertModelPath]],
    [notifierPath, require.cache[notifierPath]]
]);

let patient;
let testRoom = null;
let activeAlert = null;
const emittedAlerts = [];
const persistedVitals = [];
const originalFetch = global.fetch;

require.cache[patientModelPath] = { id: patientModelPath, filename: patientModelPath, loaded: true, exports: {
    findOne: async ({ patientId: requestedId }) => requestedId === patientId ? patient : null
} };
require.cache[vitalModelPath] = { id: vitalModelPath, filename: vitalModelPath, loaded: true, exports: {
    create: async (vital) => { persistedVitals.push(vital); return vital; }
} };
require.cache[roomModelPath] = { id: roomModelPath, filename: roomModelPath, loaded: true, exports: {
    findOne: async () => testRoom
} };
class MockAlert {
    constructor(data) { Object.assign(this, data); }
    async save() { activeAlert = this; }
    toObject() { return this; }
}
MockAlert.findOne = async ({ patientId: requestedId, status }) =>
    activeAlert?.patientId === requestedId && activeAlert?.status === status ? activeAlert : null;
MockAlert.updateMany = async () => ({ modifiedCount: 0 });
MockAlert.create = async (alert) => alert;
require.cache[alertModelPath] = { id: alertModelPath, filename: alertModelPath, loaded: true, exports: MockAlert };
require.cache[notifierPath] = { id: notifierPath, filename: notifierPath, loaded: true, exports: {
    getNotificationSocket: () => ({}),
    notifyAlertCreated(io, alert) { emittedAlerts.push(alert); },
    notifyAlertResolved() {},
    notifyPatientVitalsUpdated() {}
} };

const { processPatientVital, effectiveBaselineStatus, getSensorStatus } = require("./patientVitalService");

test.beforeEach(() => {
    patient = makePatient();
    testRoom = null;
    activeAlert = null;
    emittedAlerts.length = 0;
    persistedVitals.length = 0;
    global.fetch = originalFetch;
});

test.afterEach(() => {
    global.fetch = originalFetch;
});

test.after(() => {
    for (const [filePath, cacheEntry] of originals) {
        if (cacheEntry) require.cache[filePath] = cacheEntry;
        else delete require.cache[filePath];
    }
});

test("persists only valid normal MQTT readings and establishes a median baseline", async () => {
    const values = Array.from(
        { length: BASELINE_SAMPLE_COUNT },
        (_, index) => [79, 80, 81][index % 3]
    );
    let result;
    for (const heartRate of values) {
        result = await processPatientVital(patientId, {
            heartRate,
            spo2: 97,
            temperature: 36.7
        }, { source: "MQTT", receivedAt: new Date() });
    }

    assert.equal(result.baselineStatus, "ESTABLISHED");
    assert.equal(patient.baseline.calibrationSamples.length, BASELINE_SAMPLE_COUNT);
    assert.equal(patient.baseline.sampleCount, BASELINE_SAMPLE_COUNT);
    assert.equal(patient.baseline.heartRate, 80);
    assert.equal(patient.baseline.spo2, 97);
    assert.equal(patient.baseline.temperature, 36.7);
    assert.equal(effectiveBaselineStatus(patient), "ESTABLISHED");
    assert.equal(persistedVitals.length, BASELINE_SAMPLE_COUNT);
    assert.equal(persistedVitals.every((vital) => vital.source === "MQTT"), true);
});

test("excludes abnormal readings from calibration and does not absorb them into baseline", async () => {
    const result = await processPatientVital(patientId, {
        heartRate: 130,
        spo2: 97,
        temperature: 36.7
    }, { source: "MQTT" });

    assert.equal(result.baselineStatus, "BASELINE_CALIBRATING");
    assert.equal(patient.baseline.sampleCount, 0);
    assert.equal(patient.baseline.skippedAbnormalSamples, 1);
    assert.equal(patient.baseline.heartRate, null);
    assert.equal(patient.risk, null);
    assert.match(patient.riskSummary, /Calculate the 15-reading patient baseline/);
});

test("does not calibrate from a borderline abnormal sample that totals to LOW risk", async () => {
    const result = await processPatientVital(patientId, {
        heartRate: 115,
        spo2: 97,
        temperature: 36.7
    }, { source: "MQTT" });

    assert.equal(result.baselineStatus, "BASELINE_CALIBRATING");
    assert.equal(patient.baseline.sampleCount, 0);
    assert.equal(patient.baseline.skippedAbnormalSamples, 1);
    assert.equal(patient.risk, null);
    assert.match(patient.riskSummary, /Calculate the 15-reading patient baseline/);
});

test("does not calibrate a low body-temperature reading as normal", async () => {
    const result = await processPatientVital(patientId, {
        heartRate: 80,
        spo2: 97,
        temperature: 30.3
    }, { source: "MQTT" });

    assert.equal(result.baselineStatus, "BASELINE_CALIBRATING");
    assert.equal(patient.baseline.sampleCount, 0);
    assert.equal(patient.risk, null);
    assert.match(patient.riskSummary, /Calculate the 15-reading patient baseline/);
});

test("invalid packets leave last-valid measurements and calibration untouched", async () => {
    patient.heartRate = 82;
    patient.spo2 = 98;
    patient.temperature = 36.9;
    patient.lastValidReadingAt = new Date();

    const result = await processPatientVital(patientId, {
        heartRate: 0,
        spo2: 0,
        temperature: 36.7
    }, { source: "MQTT" });

    assert.equal(result.sensorStatus, "SENSOR_INVALID");
    assert.equal(patient.heartRate, 82);
    assert.equal(patient.spo2, 98);
    assert.equal(patient.baseline.sampleCount, 0);
    assert.equal(persistedVitals.length, 0);
    assert.equal(getSensorStatus(patient), "SENSOR_INVALID");
});

test("retained readings are marked stale and cannot enter the calibration window", async () => {
    const result = await processPatientVital(patientId, {
        heartRate: 80,
        spo2: 97,
        temperature: 36.7
    }, { source: "MQTT", retained: true });

    assert.equal(result.sensorStatus, "DATA_STALE");
    assert.equal(patient.baseline.sampleCount, 0);
    assert.equal(persistedVitals.length, 0);
});

test("HTTP-submitted readings do not alter the live patient record", async () => {
    const result = await processPatientVital(patientId, {
        heartRate: 80,
        spo2: 97,
        temperature: 36.7
    }, { source: "API" });

    assert.equal(result.ignored, true);
    assert.equal(patient.heartRate, null);
    assert.equal(patient.baseline.sampleCount, 0);
    assert.equal(persistedVitals.length, 0);
});

test("uses signed baseline deviations for the live rule risk and freezes baseline", async () => {
    patient = makePatient({ established: true });

    const result = await processPatientVital(patientId, {
        heartRate: 95,
        spo2: 95,
        temperature: 35.5
    }, { source: "MQTT" });

    assert.deepEqual(result.baselineDeviation, {
        heartRate: 15,
        spo2: -2,
        temperature: -1.2
    });
    assert.equal(result.risk.risk, "LOW");
    assert.equal(result.risk.riskReasons.some((reason) => reason.explanation.includes("below the patient's personal baseline")), true);
    assert.equal(patient.baseline.heartRate, 80);
    assert.equal(patient.baseline.spo2, 97);
    assert.equal(patient.baseline.temperature, 36.7);
});

test("tracks pulse-oximeter finger presence independently of room presence", async () => {
    await processPatientVital(patientId, {
        heartRate: 80,
        spo2: 97,
        temperature: 36.7,
        fingerDetected: true
    }, { source: "MQTT" });

    assert.equal(patient.fingerDetected, true);

    const result = await processPatientVital(patientId, {
        heartRate: 0,
        spo2: 0,
        temperature: 36.7,
        fingerDetected: false
    }, { source: "MQTT" });

    assert.equal(result.sensorStatus, "SENSOR_INVALID");
    assert.equal(patient.fingerDetected, false);
    assert.equal(patient.risk, null);
    assert.match(patient.riskSummary, /Hand not detected/);
});

test("counts changing BPM values when five consecutive readings remain above 100", async () => {
    patient = makePatient({ established: true });

    await processPatientVital(patientId, { heartRate: 105, spo2: 97, temperature: 36.7 }, { source: "MQTT" });
    assert.equal(patient.heartRateAlertState.consecutiveHighReadings, 1);
    assert.equal(patient.heartRateAlertState.lastHighHeartRate, 105);

    await processPatientVital(patientId, { heartRate: 106, spo2: 97, temperature: 36.7 }, { source: "MQTT" });
    assert.equal(patient.heartRateAlertState.consecutiveHighReadings, 2);
    assert.equal(patient.heartRateAlertState.lastHighHeartRate, 106);

    await processPatientVital(patientId, { heartRate: 107, spo2: 97, temperature: 36.7 }, { source: "MQTT" });
    await processPatientVital(patientId, { heartRate: 108, spo2: 97, temperature: 36.7 }, { source: "MQTT" });
    await processPatientVital(patientId, { heartRate: 109, spo2: 97, temperature: 36.7 }, { source: "MQTT" });
    assert.equal(patient.heartRateAlertState.consecutiveHighReadings, 5);
});

test("uses the trained AI response for valid live patient and room data and stores its timestamp", async () => {
    patient = makePatient({ established: true });
    const receivedAt = new Date("2026-09-30T10:00:00.000Z");
    testRoom = {
        temperature: 24,
        humidity: 50,
        airQuality: 100,
        lastUpdated: receivedAt
    };
    global.fetch = async () => ({
        ok: true,
        json: async () => ({
            risk: "LOW",
            riskScore: 0.98,
            riskReasons: [],
            riskSummary: "LOW risk predicted by Random Forest.",
            recommendedAction: { fan: false, buzzer: false, reason: "No action." }
        })
    });

    const result = await processPatientVital(patientId, {
        heartRate: 80,
        spo2: 97,
        temperature: 36.7
    }, { source: "MQTT", receivedAt });

    assert.equal(result.risk.aiRisk, "LOW");
    assert.equal(patient.aiRisk, "LOW");
    assert.equal(patient.aiConfidence, 0.98);
    assert.equal(patient.aiInferenceAt.toISOString(), receivedAt.toISOString());
    assert.equal(persistedVitals.at(-1).aiRisk, "LOW");
    assert.equal(persistedVitals.at(-1).aiConfidence, 0.98);
});

test("recalculates displayed risk at most once every 20 seconds while vitals continue updating", async () => {
    patient = makePatient({ established: true });
    testRoom = {
        temperature: 24,
        humidity: 50,
        airQuality: 100,
        lastUpdated: new Date("2026-09-30T10:00:00.000Z")
    };
    let aiRequests = 0;
    global.fetch = async () => {
        aiRequests += 1;
        return {
            ok: true,
            json: async () => ({
                risk: "LOW",
                riskScore: 0.98,
                riskReasons: [],
                riskSummary: "LOW model risk.",
                recommendedAction: { fan: false, buzzer: false, reason: "No action." }
            })
        };
    };

    const firstAt = new Date("2026-09-30T10:00:00.000Z");
    const secondAt = new Date("2026-09-30T10:00:05.000Z");
    const thirdAt = new Date("2026-09-30T10:00:20.000Z");
    await processPatientVital(patientId, { heartRate: 80, spo2: 97, temperature: 36.7 }, { source: "MQTT", receivedAt: firstAt });
    await processPatientVital(patientId, { heartRate: 82, spo2: 97, temperature: 36.7 }, { source: "MQTT", receivedAt: secondAt });

    assert.equal(patient.heartRate, 82);
    assert.equal(aiRequests, 1);
    assert.equal(patient.lastRiskAssessmentAt.toISOString(), firstAt.toISOString());

    await processPatientVital(patientId, { heartRate: 84, spo2: 97, temperature: 36.7 }, { source: "MQTT", receivedAt: thirdAt });
    assert.equal(aiRequests, 2);
    assert.equal(patient.lastRiskAssessmentAt.toISOString(), thirdAt.toISOString());
});

test("uses safety screening without exposing model-domain diagnostics to the UI", async () => {
    patient = makePatient({ established: true });
    testRoom = {
        temperature: 30.6,
        humidity: 58.3,
        airQuality: 414,
        lastUpdated: new Date()
    };
    let aiRequests = 0;
    global.fetch = async () => {
        aiRequests += 1;
        throw new Error("AI should not be called for out-of-domain readings");
    };

    const result = await processPatientVital(patientId, {
        heartRate: 80,
        spo2: 97,
        temperature: 28.9
    }, { source: "MQTT", receivedAt: new Date() });

    assert.equal(result.risk.aiRisk, null);
    assert.equal(patient.aiInferenceAt, null);
    assert.equal(aiRequests, 0);
    assert.doesNotMatch(patient.riskSummary, /training range|trained domain|AI model skipped/i);
    assert.match(patient.riskSummary, /MODERATE risk: elevated readings detected/i);
    assert.match(patient.riskSummary, /Temperature/);
    assert.match(patient.riskSummary, /Air Quality/);
});

test("emits one personalized BPM alert only after five consecutive high readings and resolves when reset", async () => {
    patient = makePatient({ established: true });
    const episodeStart = new Date("2026-09-30T12:00:00.000Z");
    testRoom = {
        temperature: 24,
        humidity: 50,
        airQuality: 100,
        lastUpdated: episodeStart
    };
    global.fetch = async (url, options) => {
        const { heartRate } = JSON.parse(options.body);
        const high = heartRate > 100;
        return {
            ok: true,
            json: async () => ({
                risk: high ? "HIGH" : "LOW",
                riskScore: high ? 0.91 : 0.96,
                riskReasons: high ? [{
                    factor: "Heart Rate",
                    value: heartRate,
                    shapValue: 0.2,
                    severity: "HIGH",
                    explanation: "Heart rate drove the model result."
                }] : [],
                riskSummary: `${high ? "HIGH" : "LOW"} model risk.`,
                recommendedAction: { fan: false, buzzer: high, reason: "Test result." }
            })
        };
    };

    for (const [index, heartRate] of [101, 103, 105, 107, 109].entries()) {
        await processPatientVital(patientId, { heartRate, spo2: 97, temperature: 36.7 }, {
            source: "MQTT",
            receivedAt: new Date(episodeStart.getTime() + index * 5_000)
        });
        if (index < 4) {
            assert.equal(emittedAlerts.filter((alert) => alert.risk === "HIGH").length, 0);
            assert.equal(patient.risk, "MODERATE");
        }
    }
    assert.equal(patient.risk, "HIGH");
    assert.equal(emittedAlerts.filter((alert) => alert.risk === "HIGH").length, 1);
    assert.equal(patient.heartRateAlertState.notificationActive, true);
    assert.match(activeAlert.summary, /personalized 100 BPM threshold/);
    assert.match(activeAlert.summary, /baseline 80 BPM/);

    await processPatientVital(patientId, { heartRate: 0, spo2: 0, temperature: 36.7 }, { source: "MQTT" });
    assert.equal(patient.heartRateAlertState.consecutiveHighReadings, 0);
    assert.equal(emittedAlerts.filter((alert) => alert.risk === "HIGH").length, 1);

    await processPatientVital(patientId, { heartRate: 98, spo2: 97, temperature: 36.7 }, {
        source: "MQTT",
        receivedAt: new Date(episodeStart.getTime() + 25_000)
    });

    for (const [index, heartRate] of [102, 104, 106, 108, 110].entries()) {
        await processPatientVital(patientId, { heartRate, spo2: 97, temperature: 36.7 }, {
            source: "MQTT",
            receivedAt: new Date(episodeStart.getTime() + 30_000 + index * 5_000)
        });
    }
    assert.equal(emittedAlerts.filter((alert) => alert.risk === "HIGH").length, 2);
    assert.match(activeAlert.summary, /5 consecutive readings/);
});

test("does not create an active alert for non-BPM HIGH risk", async () => {
    patient = makePatient({ established: true });

    await processPatientVital(patientId, {
        heartRate: 80,
        spo2: 85,
        temperature: 39
    }, { source: "MQTT", receivedAt: new Date() });

    assert.equal(patient.heartRateAlertState.consecutiveHighReadings, 0);
    assert.equal(emittedAlerts.filter((alert) => alert.risk === "HIGH").length, 0);
    assert.equal(activeAlert, null);
    assert.equal(patient.risk, "MODERATE");
});
