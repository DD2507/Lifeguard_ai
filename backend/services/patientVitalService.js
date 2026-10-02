const Patient = require("../models/Patient");
const Vital = require("../models/Vital");
const Room = require("../models/room");
const Alert = require("../models/Alert");

const {
    predictWithAI,
    getModelInputIssues
} = require("./aiClient");
const { calculateRisk } = require("./riskEngine");
const {
    BASELINE_SAMPLE_COUNT,
    validateReading,
    isNormalBaselineReading,
    calculateBaseline,
    calculateDeviation,
    isPersistedBaseline
} = require("./baselineService");
const {
    getNotificationSocket,
    notifyAlertCreated,
    notifyAlertResolved,
    notifyPatientVitalsUpdated
} = require("./notificationService");
const {
    HIGH_BPM_CONSECUTIVE_READINGS,
    getPersonalizedHighBpmThreshold
} = require("./heartRateActuatorPolicy");

const SENSOR_STALE_AFTER_MS = Math.max(
    1_000,
    Number(process.env.SENSOR_STALE_AFTER_MS) || 30_000
);
const HIGH_HEART_RATE_THRESHOLD = 100;
const LOW_HEART_RATE_THRESHOLD = 50;
const RISK_ASSESSMENT_INTERVAL_MS = Math.max(
    1_000,
    Number(process.env.RISK_ASSESSMENT_INTERVAL_MS) || 20_000
);
const patientQueues = new Map();

function isRiskAssessmentDue(patient, receivedAt) {
    if (!patient.lastRiskAssessmentAt) return true;
    return receivedAt.getTime() - new Date(patient.lastRiskAssessmentAt).getTime() >=
        RISK_ASSESSMENT_INTERVAL_MS;
}

function updateHeartRateAlertState(patient, heartRate) {
    const current = patient.heartRateAlertState || {};
    const state = {
        consecutiveHighReadings: Number(current.consecutiveHighReadings) || 0,
        lastHighHeartRate: current.lastHighHeartRate != null &&
            Number.isFinite(Number(current.lastHighHeartRate))
            ? Number(current.lastHighHeartRate)
            : null,
        notificationActive: current.notificationActive === true
    };

    const highThreshold = getPersonalizedHighBpmThreshold({
        baselineHeartRate: patient.baseline?.heartRate,
        baselineEstablished: effectiveBaselineStatus(patient) === "ESTABLISHED"
    });
    const isPersonalizedHigh = highThreshold !== null && heartRate > highThreshold;

    if (isPersonalizedHigh) {
        state.consecutiveHighReadings += 1;
        state.lastHighHeartRate = heartRate;
    } else {
        state.consecutiveHighReadings = 0;
        state.lastHighHeartRate = null;
    }

    if (!isPersonalizedHigh) {
        state.notificationActive = false;
    }

    patient.heartRateAlertState = state;
    return state;
}

function resetConsecutiveHighReadings(patient) {
    const current = patient.heartRateAlertState || {};
    patient.heartRateAlertState = {
        consecutiveHighReadings: 0,
        lastHighHeartRate: null,
        notificationActive: current.notificationActive === true
    };
}

function shouldNotifyRiskAlert(patient, heartRate) {
    const state = patient.heartRateAlertState;
    const highThreshold = getPersonalizedHighBpmThreshold({
        baselineHeartRate: patient.baseline?.heartRate,
        baselineEstablished: effectiveBaselineStatus(patient) === "ESTABLISHED"
    });
    const alertEligible = highThreshold !== null &&
        heartRate > highThreshold &&
        Number(state?.consecutiveHighReadings) >= HIGH_BPM_CONSECUTIVE_READINGS;
    if (!alertEligible) {
        return { alertEligible: false, allowed: false, force: false };
    }
    const isNewEpisode = state.notificationActive !== true;
    state.notificationActive = true;
    return {
        alertEligible: true,
        allowed: isNewEpisode,
        force: isNewEpisode
    };
}

function effectiveBaselineStatus(patient) {
    return isPersistedBaseline(patient.baseline)
        ? "ESTABLISHED"
        : "BASELINE_CALIBRATING";
}

function buildRoomContext(room, now) {
    if (!room || !room.lastUpdated || now - new Date(room.lastUpdated) > SENSOR_STALE_AFTER_MS) {
        return {
            context: { temperature: null, humidity: null, airQuality: null },
            usableForAI: false,
            aiIssue: "Room readings are missing or stale."
        };
    }

    const context = {
        temperature: Number(room.temperature),
        humidity: Number(room.humidity),
        airQuality: Number(room.airQuality),
        presenceDetected: Boolean(room.presenceDetected)
    };
    const usableForAI =
        Number.isFinite(context.temperature) && context.temperature > 0 && context.temperature <= 60 &&
        Number.isFinite(context.humidity) && context.humidity > 0 && context.humidity <= 100 &&
        Number.isFinite(context.airQuality) && context.airQuality > 0 && context.airQuality <= 500;

    if (!usableForAI) {
        const invalidFields = Object.entries(context)
            .filter(([field, value]) => field !== "presenceDetected" &&
                (!Number.isFinite(value) || value <= 0))
            .map(([field]) => field);
        context.temperature = null;
        context.humidity = null;
        context.airQuality = null;
        return {
            context,
            usableForAI: false,
            aiIssue: invalidFields.length
                ? `Room sensor values are invalid: ${invalidFields.join(", ")}.`
                : "Room readings are outside the accepted sensor range."
        };
    }

    return { context, usableForAI, aiIssue: null };
}

function patientEventPayload(patient, extra = {}) {
    const sensorStatus = getSensorStatus(patient);
    const baselineStatus = effectiveBaselineStatus(patient);
    const handDetected = patient.fingerDetected === true;
    const riskAvailable = handDetected && sensorStatus === "LIVE" && baselineStatus === "ESTABLISHED";
    const currentRisk = riskAvailable ? patient.risk : null;
    const unavailableSummary = !handDetected
        ? "Hand not detected. Place a finger on the pulse-oximeter sensor to show the risk."
        : baselineStatus !== "ESTABLISHED"
            ? "Calculate the 15-reading patient baseline to show the risk."
            : `${sensorStatus}: risk score withheld until valid live readings resume.`;
    return {
        patientId: patient.patientId,
        name: patient.name,
        room: patient.room,
        heartRate: patient.heartRate,
        spo2: patient.spo2,
        temperature: patient.temperature,
        fingerDetected: patient.fingerDetected === true,
        baseline: patient.baseline,
        baselineStatus,
        baselineRequiredSamples: BASELINE_SAMPLE_COUNT,
        baselineDeviation: patient.baselineDeviation,
        sensorStatus,
        lastSensorMessageAt: patient.lastSensorMessageAt,
        lastValidReadingAt: patient.lastValidReadingAt,
        lastSensorError: patient.lastSensorError,
        risk: currentRisk,
        riskScore: currentRisk ? patient.riskScore : null,
        aiRisk: currentRisk ? patient.aiRisk : null,
        aiConfidence: currentRisk ? patient.aiConfidence : null,
        aiInferenceAt: currentRisk && patient.aiRisk ? patient.aiInferenceAt : null,
        lastRiskAssessmentAt: currentRisk ? patient.lastRiskAssessmentAt : null,
        riskReasons: currentRisk ? patient.riskReasons : [],
        riskSummary: riskAvailable ? patient.riskSummary : unavailableSummary,
        recommendedAction: patient.recommendedAction,
        roomContext: patient.roomContext,
        ...extra
    };
}

async function publishPatientUpdate(patient, extra) {
    const io = getNotificationSocket();
    if (io) notifyPatientVitalsUpdated(io, patientEventPayload(patient, extra));
}

function mergeRiskResults(ruleResult, aiResult, aiIssue = "No AI inference result was returned.") {
    const rank = { LOW: 0, MODERATE: 1, HIGH: 2 };
    const risk = aiResult && rank[aiResult.risk] > rank[ruleResult.risk]
        ? aiResult.risk
        : ruleResult.risk;
    const reasons = [...ruleResult.riskReasons];

    if (aiResult && risk === aiResult.risk) {
        for (const reason of aiResult.riskReasons || []) {
            if (!reasons.some((item) => item.factor === reason.factor)) reasons.push(reason);
        }
    }

    const contributingFactors = reasons
        .map((reason) => reason.factor)
        .filter(Boolean)
        .filter((factor, index, factors) => factors.indexOf(factor) === index);
    const factorText = contributingFactors.length
        ? ` Contributing factors: ${contributingFactors.join(", ")}.`
        : " Current readings are within the configured monitoring limits.";

    return {
        risk,
        riskScore: ruleResult.riskScore,
        riskReasons: reasons,
        // Keep model-domain and service diagnostics internal. The dashboard should
        // explain the assessment, not expose implementation details to caregivers.
        riskSummary: `${risk} risk assessment based on the current live readings.${factorText}`,
        recommendedAction: {
            fan: ruleResult.recommendedAction.fan || Boolean(aiResult?.recommendedAction?.fan),
            buzzer: risk === "HIGH" || Boolean(aiResult?.recommendedAction?.buzzer),
            reason: risk === "HIGH"
                ? "High prototype screening risk; clinical review is recommended."
                : ruleResult.recommendedAction.reason
        },
        aiRisk: aiResult?.risk || null,
        aiConfidence: aiResult?.riskScore ?? null,
        aiInferenceAt: aiResult?.inferenceAt ?? null
    };
}

function describeModelInputIssues(issues) {
    return issues.map(({ feature, value, minimum, maximum, reason }) =>
        value == null
            ? `${feature} is ${reason}`
            : `${feature}=${value} is ${reason} [${minimum}, ${maximum}]`
    ).join("; ");
}

async function getRiskAssessment(vitals, roomContext, baselineDeviation, useAI, aiIssue, receivedAt) {
    const ruleResult = calculateRisk(vitals, roomContext, baselineDeviation);
    let aiResult = null;
    let inferenceIssue = aiIssue;
    const inputIssues = getModelInputIssues(vitals, roomContext, baselineDeviation);

    if (useAI && inputIssues.length === 0) {
        try {
            aiResult = await predictWithAI(vitals, roomContext, baselineDeviation);
            aiResult.inferenceAt = receivedAt;
        } catch (error) {
            console.error("AI risk prediction unavailable:", error.message);
            inferenceIssue = `AI service request failed: ${error.message}`;
        }
    } else if (inputIssues.length) {
        inferenceIssue = `AI input outside the trained domain or incomplete: ${describeModelInputIssues(inputIssues)}.`;
    }

    return mergeRiskResults(
        ruleResult,
        aiResult,
        inferenceIssue || "Room readings are incomplete or unavailable for AI inference."
    );
}

function applyBpmOnlyHighPolicy(
    riskResult,
    heartRate,
    personalizedHighThreshold,
    consecutiveHighReadings
) {
    if (!riskResult) return null;
    const sustainedPersonalizedHigh = personalizedHighThreshold !== null &&
        heartRate > personalizedHighThreshold &&
        Number(consecutiveHighReadings) >= HIGH_BPM_CONSECUTIVE_READINGS;

    if (sustainedPersonalizedHigh) {
        const otherFactors = (riskResult.riskReasons || [])
            .map((reason) => reason.factor)
            .filter((factor) => factor && factor !== "Heart Rate")
            .filter((factor, index, factors) => factors.indexOf(factor) === index);
        const factorText = otherFactors.length
            ? ` Other contributing factors: ${otherFactors.join(", ")}.`
            : "";
        return {
            ...riskResult,
            risk: "HIGH",
            riskScore: Math.max(Number(riskResult.riskScore) || 0, 0.60),
            riskSummary: `HIGH risk: heart rate remained above the personalized ${personalizedHighThreshold} BPM threshold for ${consecutiveHighReadings} consecutive live readings (current: ${heartRate} BPM).${factorText}`,
            recommendedAction: {
                ...riskResult.recommendedAction,
                buzzer: true,
                reason: "Sustained personalized BPM threshold crossed; verify the sensor reading and check the patient."
            }
        };
    }

    if (riskResult.risk === "HIGH") {
        const contributingFactors = (riskResult.riskReasons || [])
            .map((reason) => reason.factor)
            .filter(Boolean)
            .filter((factor, index, factors) => factors.indexOf(factor) === index);
        const factorText = contributingFactors.length
            ? ` Contributing factors: ${contributingFactors.join(", ")}.`
            : "";
        return {
            ...riskResult,
            risk: "MODERATE",
            riskScore: Math.min(Number(riskResult.riskScore) || 0.59, 0.59),
            riskSummary: `MODERATE risk: elevated readings detected. HIGH risk requires ${HIGH_BPM_CONSECUTIVE_READINGS} consecutive heart-rate readings above the personalized ${personalizedHighThreshold ?? "configured"} BPM threshold. Current sequence: ${consecutiveHighReadings}/${HIGH_BPM_CONSECUTIVE_READINGS}.${factorText}`,
            recommendedAction: {
                ...riskResult.recommendedAction,
                buzzer: false
            }
        };
    }

    return riskResult;
}

async function updateAlert(patient, riskResult, previousRisk, notificationDecision) {
    if (notificationDecision.alertEligible) {
        let alert = await Alert.findOne({
            patientId: patient.patientId,
            alertType: "PATIENT_RISK",
            status: "ACTIVE"
        });
        const isNew = !alert;
        if (!alert) alert = new Alert({
            alertType: "PATIENT_RISK",
            patientId: patient.patientId,
            patientName: patient.name,
            room: patient.room,
            status: "ACTIVE"
        });

        const liveBpm = Number(patient.heartRate);
        const baselineBpm = Number(patient.baseline?.heartRate);
        const hasBaseline = Number.isFinite(baselineBpm) && baselineBpm > 0;
        const highThreshold = getPersonalizedHighBpmThreshold({
            baselineHeartRate: baselineBpm,
            baselineEstablished: hasBaseline
        });
        alert.risk = "HIGH";
        alert.riskScore = 1;
        alert.reasons = [{
            factor: "Heart Rate",
            value: liveBpm,
            severity: "HIGH",
            explanation: hasBaseline
                ? `Live heart rate remained above the personalized ${highThreshold} BPM threshold for ${HIGH_BPM_CONSECUTIVE_READINGS} consecutive readings; saved BPM baseline is ${baselineBpm} BPM.`
                : `Live heart rate remained high for ${HIGH_BPM_CONSECUTIVE_READINGS} consecutive readings.`
        }];
        alert.summary = hasBaseline
            ? `BPM ALERT: ${HIGH_BPM_CONSECUTIVE_READINGS} consecutive readings exceeded the personalized ${highThreshold} BPM threshold (live ${liveBpm} BPM; baseline ${baselineBpm} BPM).`
            : `BPM ALERT: live heart rate ${liveBpm} BPM.`;
        alert.recommendedAction = {
            fan: false,
            buzzer: true,
            reason: "Verify the pulse sensor reading and check the patient."
        };
        alert.room = patient.room;
        await alert.save();

        if (notificationDecision.allowed &&
            (notificationDecision.force || isNew || previousRisk !== "HIGH")) {
            const io = getNotificationSocket();
            if (io) notifyAlertCreated(io, alert.toObject ? alert.toObject() : alert);
        }
        return;
    }

    const activeAlert = await Alert.findOne({
        patientId: patient.patientId,
        alertType: "PATIENT_RISK",
        status: "ACTIVE"
    });
    if (activeAlert) {
        activeAlert.status = "RESOLVED";
        activeAlert.resolvedAt = new Date();
        await activeAlert.save();
        const io = getNotificationSocket();
        if (io) notifyAlertResolved(io, patient.patientId, activeAlert._id);
    }
}

async function processPatientVitalSerial(patientId, vitals, metadata = {}) {
    const receivedAt = metadata.receivedAt ? new Date(metadata.receivedAt) : new Date();
    const patient = await Patient.findOne({ patientId });
    if (!patient) throw new Error("Patient not found");

    if (metadata.source && metadata.source !== "MQTT") {
        return {
            baselineStatus: effectiveBaselineStatus(patient),
            sensorStatus: getSensorStatus(patient),
            ignored: true,
            patient
        };
    }

    patient.lastSensorMessageAt = receivedAt;
    patient.fingerDetected = !metadata.retained &&
        !metadata.stale &&
        vitals?.fingerDetected === true;
    if (metadata.retained || metadata.stale) {
        resetConsecutiveHighReadings(patient);
        patient.sensorStatus = "DATA_STALE";
        patient.lastSensorError = metadata.retained
            ? "Retained MQTT reading was not treated as a new live sample"
            : "Sensor reading timestamp is stale";
        await patient.save();
        await publishPatientUpdate(patient);
        return { baselineStatus: effectiveBaselineStatus(patient), sensorStatus: patient.sensorStatus, patient };
    }

    const validation = validateReading(vitals);
    if (!validation.valid) {
        resetConsecutiveHighReadings(patient);
        patient.sensorStatus = "SENSOR_INVALID";
        patient.lastSensorError = metadata.error || validation.reason;
        patient.risk = null;
        patient.riskScore = null;
        patient.aiRisk = null;
        patient.aiConfidence = null;
        patient.aiInferenceAt = null;
        patient.riskReasons = [];
        patient.riskSummary = vitals?.fingerDetected === false
            ? "Hand not detected. Place a finger on the pulse-oximeter sensor to show the risk."
            : "A valid live sensor reading is required before risk can be assessed.";
        patient.recommendedAction = {
            fan: false,
            buzzer: false,
            reason: patient.riskSummary
        };
        await updateAlert(
            patient,
            {},
            null,
            { alertEligible: false, allowed: false, force: false }
        );
        await patient.save();
        await publishPatientUpdate(patient);
        return { baselineStatus: effectiveBaselineStatus(patient), sensorStatus: patient.sensorStatus, patient };
    }

    const liveVitals = validation.vitals;
    const room = await Room.findOne({ roomId: patient.room });
    const { context: roomContext, usableForAI, aiIssue: roomAiIssue } = buildRoomContext(room, receivedAt.getTime());

    patient.sensorStatus = "LIVE";
    patient.lastSensorError = "";
    patient.lastValidReadingAt = receivedAt;
    patient.heartRate = liveVitals.heartRate;
    patient.spo2 = liveVitals.spo2;
    patient.temperature = liveVitals.temperature;
    patient.roomContext = roomContext;

    if (patient.baseline.established && !isPersistedBaseline(patient.baseline)) {
        patient.baseline.heartRate = null;
        patient.baseline.spo2 = null;
        patient.baseline.temperature = null;
        patient.baseline.sampleCount = 0;
        patient.baseline.calibrationSamples = [];
        patient.baseline.established = false;
        patient.baseline.calibrationStatus = "BASELINE_CALIBRATING";
        patient.baseline.establishedAt = null;
        patient.baselineDeviation = { heartRate: null, spo2: null, temperature: null };
    }

    let baselineStatus = effectiveBaselineStatus(patient);
    let baselineDeviation = null;
    let riskResult = null;
    const previousRisk = patient.risk;
    let riskAssessmentDue = isRiskAssessmentDue(patient, receivedAt);

    if (baselineStatus !== "ESTABLISHED") {
        const screening = calculateRisk(liveVitals);
        const calibrationEligible = screening.riskReasons.length === 0 &&
            liveVitals.heartRate >= 60 && liveVitals.heartRate <= 100 &&
            liveVitals.spo2 >= 94 &&
            liveVitals.temperature >= 34 && liveVitals.temperature < 38;
        if (calibrationEligible) {
            // Discard legacy/partial samples that did not capture all three
            // vitals together. Every baseline point must represent one
            // complete live IoT reading.
            const samples = (patient.baseline.calibrationSamples || [])
                .filter((sample) => isNormalBaselineReading(sample));
            samples.push({ ...liveVitals, receivedAt });
            patient.baseline.calibrationSamples = samples.slice(-BASELINE_SAMPLE_COUNT);
            patient.baseline.sampleCount = patient.baseline.calibrationSamples.length;
        } else {
            patient.baseline.skippedAbnormalSamples = (patient.baseline.skippedAbnormalSamples || 0) + 1;
        }

        const calculatedBaseline = calculateBaseline(patient.baseline.calibrationSamples || []);
        if (calculatedBaseline) {
            patient.baseline.heartRate = calculatedBaseline.heartRate;
            patient.baseline.spo2 = calculatedBaseline.spo2;
            patient.baseline.temperature = calculatedBaseline.temperature;
            patient.baseline.established = true;
            patient.baseline.calibrationStatus = "ESTABLISHED";
            patient.baseline.establishedAt = receivedAt;
            baselineStatus = "ESTABLISHED";
        }

        if (baselineStatus === "BASELINE_CALIBRATING") {
            patient.risk = null;
            patient.riskScore = null;
            patient.aiRisk = null;
            patient.aiConfidence = null;
            patient.aiInferenceAt = null;
            patient.riskReasons = [];
            patient.riskSummary = "Calculate the 15-reading patient baseline to show the risk.";
            patient.recommendedAction = {
                fan: false,
                buzzer: false,
                reason: "Risk assessment is waiting for the patient baseline."
            };
        }
    }

    if (baselineStatus === "ESTABLISHED") {
        patient.baseline.calibrationStatus = "ESTABLISHED";
        const alertState = updateHeartRateAlertState(patient, liveVitals.heartRate);
        if (alertState.consecutiveHighReadings === HIGH_BPM_CONSECUTIVE_READINGS) {
            riskAssessmentDue = true;
        }
        baselineDeviation = calculateDeviation(liveVitals, patient.baseline);
        patient.baselineDeviation = baselineDeviation;
        if (riskAssessmentDue) {
            riskResult = await getRiskAssessment(liveVitals, roomContext, baselineDeviation, usableForAI, roomAiIssue, receivedAt);
        }
    }

    if (baselineStatus !== "ESTABLISHED") {
        resetConsecutiveHighReadings(patient);
    }

    const personalizedHighThreshold = getPersonalizedHighBpmThreshold({
        baselineHeartRate: patient.baseline?.heartRate,
        baselineEstablished: baselineStatus === "ESTABLISHED"
    });
    const bpmIsCritical = (personalizedHighThreshold !== null && liveVitals.heartRate > personalizedHighThreshold) ||
        liveVitals.heartRate < LOW_HEART_RATE_THRESHOLD;
    if (baselineStatus === "ESTABLISHED" && !riskResult && bpmIsCritical && riskAssessmentDue) {
        riskResult = calculateRisk(liveVitals, roomContext, baselineDeviation || {});
    }
    riskResult = applyBpmOnlyHighPolicy(
        riskResult,
        liveVitals.heartRate,
        personalizedHighThreshold,
        patient.heartRateAlertState?.consecutiveHighReadings || 0
    );

    if (riskResult) {
        patient.lastRiskAssessmentAt = receivedAt;
        patient.risk = riskResult.risk;
        patient.riskScore = riskResult.riskScore;
        patient.riskReasons = riskResult.riskReasons;
        patient.riskSummary = riskResult.riskSummary;
        patient.recommendedAction = riskResult.recommendedAction;
        patient.aiRisk = riskResult.aiRisk;
        patient.aiConfidence = riskResult.aiConfidence;
        patient.aiInferenceAt = riskResult.aiInferenceAt;
    }

    const notificationDecision = baselineStatus === "ESTABLISHED"
        ? shouldNotifyRiskAlert(patient, liveVitals.heartRate)
        : { alertEligible: false, allowed: false, force: false };
    patient.recommendedAction = {
        ...(patient.recommendedAction || {}),
        buzzer: notificationDecision.alertEligible,
        reason: notificationDecision.alertEligible
            ? `Heart rate exceeded the personalized ${personalizedHighThreshold} BPM threshold for ${HIGH_BPM_CONSECUTIVE_READINGS} consecutive live readings.`
            : patient.recommendedAction?.reason || "No immediate room intervention is required."
    };

    await patient.save();

    const vital = await Vital.create({
        patientId: patient.patientId,
        room: patient.room,
        heartRate: liveVitals.heartRate,
        spo2: liveVitals.spo2,
        temperature: liveVitals.temperature,
        receivedAt,
        source: "MQTT",
        baselineDeviation,
        risk: riskResult?.risk ?? null,
        riskScore: riskResult?.riskScore ?? null,
        aiRisk: riskResult?.aiRisk ?? null,
        aiConfidence: riskResult?.aiConfidence ?? null,
        riskReasons: riskResult?.riskReasons ?? [],
        riskSummary: riskResult?.riskSummary ?? patient.riskSummary,
        recommendedAction: riskResult?.recommendedAction ?? patient.recommendedAction
    });

    if (baselineStatus === "ESTABLISHED") {
        await updateAlert(patient, riskResult || {}, previousRisk, notificationDecision);
        await patient.save();
    } else {
        await updateAlert(
            patient,
            {},
            previousRisk,
            { alertEligible: false, allowed: false, force: false }
        );
    }
    await publishPatientUpdate(patient, { baselineStatus });

    return {
        baselineStatus,
        baseline: patient.baseline,
        baselineDeviation,
        patient,
        vital,
        risk: riskResult
    };
}

function processPatientVital(patientId, vitals, metadata = {}) {
    const previous = patientQueues.get(patientId) || Promise.resolve();
    const current = previous
        .catch(() => {})
        .then(() => processPatientVitalSerial(patientId, vitals, metadata));
    patientQueues.set(patientId, current);
    return current.finally(() => {
        if (patientQueues.get(patientId) === current) patientQueues.delete(patientId);
    });
}

function getSensorStatus(patient, now = Date.now()) {
    if (patient.sensorStatus === "SENSOR_INVALID") return "SENSOR_INVALID";
    if (patient.sensorStatus === "DATA_STALE") return "DATA_STALE";
    if (!patient.lastValidReadingAt) {
        return "SENSOR_DISCONNECTED";
    }
    if (now - new Date(patient.lastValidReadingAt).getTime() > SENSOR_STALE_AFTER_MS) return "DATA_STALE";
    return "LIVE";
}

module.exports = {
    processPatientVital,
    effectiveBaselineStatus,
    getSensorStatus,
    SENSOR_STALE_AFTER_MS,
    HIGH_HEART_RATE_THRESHOLD,
    LOW_HEART_RATE_THRESHOLD,
    RISK_ASSESSMENT_INTERVAL_MS
};
