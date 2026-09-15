const BASELINE_SAMPLE_COUNT = 10;

const baselineBuffers = new Map();

function getBuffer(patientId) {
    if (!baselineBuffers.has(patientId)) {
        baselineBuffers.set(patientId, []);
    }

    return baselineBuffers.get(patientId);
}

function addSample(patientId, vitals) {
    const buffer = getBuffer(patientId);

    buffer.push({
        heartRate: Number(vitals.heartRate),
        spo2: Number(vitals.spo2),
        temperature: Number(vitals.temperature)
    });

    if (buffer.length > BASELINE_SAMPLE_COUNT) {
        buffer.shift();
    }

    return {
        samplesCollected: buffer.length,
        requiredSamples: BASELINE_SAMPLE_COUNT,
        established: buffer.length >= BASELINE_SAMPLE_COUNT
    };
}

function calculateBaseline(patientId) {
    const buffer = getBuffer(patientId);

    if (buffer.length < BASELINE_SAMPLE_COUNT) {
        return null;
    }

    const total = buffer.reduce(
        (sum, sample) => ({
            heartRate: sum.heartRate + sample.heartRate,
            spo2: sum.spo2 + sample.spo2,
            temperature: sum.temperature + sample.temperature
        }),
        {
            heartRate: 0,
            spo2: 0,
            temperature: 0
        }
    );

    return {
        heartRate: Number((total.heartRate / buffer.length).toFixed(2)),
        spo2: Number((total.spo2 / buffer.length).toFixed(2)),
        temperature: Number((total.temperature / buffer.length).toFixed(2))
    };
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

function resetBaseline(patientId) {
    baselineBuffers.delete(patientId);
}

module.exports = {
    BASELINE_SAMPLE_COUNT,
    addSample,
    calculateBaseline,
    calculateDeviation,
    resetBaseline
};