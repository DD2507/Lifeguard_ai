const configuredSampleCount = Number.parseInt(
    process.env.BASELINE_SAMPLE_COUNT || "15",
    10
);
const BASELINE_SAMPLE_COUNT = Number.isInteger(configuredSampleCount) && configuredSampleCount > 0
    ? configuredSampleCount
    : 15;

const VALID_RANGES = {
    heartRate: { minimum: 30, maximum: 220 },
    spo2: { minimum: 70, maximum: 100 },
    temperature: { minimum: 25, maximum: 45 }
};

const BASELINE_RANGES = {
    heartRate: { minimum: 60, maximum: 100 },
    spo2: { minimum: 94, maximum: 100 },
    // The prototype uses a contact/surface sensor whose accepted calibration
    // range starts at 34°C rather than a clinical core-temperature boundary.
    temperature: { minimum: 34, maximum: 37.9 }
};

function isNormalBaselineReading(vitals) {
    return validateReading(vitals).valid &&
        Object.entries(BASELINE_RANGES).every(([metric, range]) => {
            const value = Number(vitals[metric]);
            return value >= range.minimum && value <= range.maximum;
        });
}

function validateReading(vitals) {
    if (!vitals || typeof vitals !== "object") {
        return { valid: false, reason: "Reading payload is not an object" };
    }

    if (vitals.fingerDetected === false) {
        return { valid: false, reason: "Pulse-oximeter finger contact is absent" };
    }

    if ([vitals.heartRateStatus, vitals.spo2Status].some(
        (status) => String(status || "").trim().toUpperCase() === "INVALID"
    )) {
        return { valid: false, reason: "Pulse-oximeter marked a measurement invalid" };
    }

    for (const [metric, range] of Object.entries(VALID_RANGES)) {
        const value = Number(vitals[metric]);
        if (!Number.isFinite(value) || value <= 0) {
            return { valid: false, reason: `${metric} is missing or non-positive` };
        }
        if (value < range.minimum || value > range.maximum) {
            return { valid: false, reason: `${metric} is outside the accepted sensor range` };
        }
    }

    return {
        valid: true,
        vitals: {
            heartRate: Number(vitals.heartRate),
            spo2: Number(vitals.spo2),
            temperature: Number(vitals.temperature)
        }
    };
}

function median(values) {
    const sorted = values.slice().sort((left, right) => left - right);
    const middle = Math.floor(sorted.length / 2);
    const result = sorted.length % 2
        ? sorted[middle]
        : (sorted[middle - 1] + sorted[middle]) / 2;
    return Number(result.toFixed(2));
}

function calculateBaseline(samples, method = "median") {
    if (!Array.isArray(samples) || samples.length < BASELINE_SAMPLE_COUNT) {
        return null;
    }

    if (method !== "median" && method !== "mean") return null;
    const window = method === "mean" ? samples : samples.slice(-BASELINE_SAMPLE_COUNT);
    if (window.length < BASELINE_SAMPLE_COUNT) return null;
    if (window.some((sample) => !validateReading(sample).valid)) return null;

    const aggregate = (values) => method === "mean"
        ? Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2))
        : median(values);

    return {
        heartRate: aggregate(window.map((sample) => Number(sample.heartRate))),
        spo2: aggregate(window.map((sample) => Number(sample.spo2))),
        temperature: aggregate(window.map((sample) => Number(sample.temperature)))
    };
}

function isValidBaseline(baseline) {
    return Boolean(
        baseline &&
        Object.entries(VALID_RANGES).every(([metric, range]) => {
            const value = Number(baseline[metric]);
            return Number.isFinite(value) && value >= range.minimum && value <= range.maximum;
        })
    );
}

function isPersistedBaseline(baseline) {
    if (
        !baseline ||
        baseline.established !== true ||
        baseline.calibrationStatus !== "ESTABLISHED" ||
        !baseline.establishedAt ||
        !Array.isArray(baseline.calibrationSamples) ||
        baseline.calibrationSamples.length < BASELINE_SAMPLE_COUNT ||
        !isValidBaseline(baseline)
    ) return false;

    const method = baseline.baselineMethod || "median";
    const calculated = calculateBaseline(baseline.calibrationSamples, method);
    return Boolean(
        calculated &&
        calculated.heartRate === Number(baseline.heartRate) &&
        calculated.spo2 === Number(baseline.spo2) &&
        calculated.temperature === Number(baseline.temperature)
    );
}

function calculateDeviation(vitals, baseline) {
    if (
        !baseline ||
        !baseline.established ||
        baseline.heartRate === null ||
        baseline.spo2 === null ||
        baseline.temperature === null
    ) {
        return {
            heartRate: null,
            spo2: null,
            temperature: null
        };
    }

    return {
        heartRate: Number(
            (vitals.heartRate - baseline.heartRate).toFixed(2)
        ),

        spo2: Number(
            (vitals.spo2 - baseline.spo2).toFixed(2)
        ),

        temperature: Number(
            (vitals.temperature - baseline.temperature).toFixed(2)
        )
    };
}

module.exports = {
    BASELINE_SAMPLE_COUNT,
    VALID_RANGES,
    BASELINE_RANGES,
    validateReading,
    isNormalBaselineReading,
    calculateBaseline,
    calculateDeviation,
    isValidBaseline,
    isPersistedBaseline
};
