const configuredConsecutiveReadings = Number.parseInt(
    process.env.HIGH_BPM_CONSECUTIVE_READINGS || "5",
    10
);

const HIGH_BPM_THRESHOLD = 100;
const HIGH_BPM_BASELINE_DELTA = 15;
const HIGH_BPM_CONSECUTIVE_READINGS =
    Number.isInteger(configuredConsecutiveReadings) && configuredConsecutiveReadings > 0
        ? configuredConsecutiveReadings
        : 5;

function getPersonalizedHighBpmThreshold({ baselineHeartRate, baselineEstablished }) {
    const baseline = Number(baselineHeartRate);
    if (baselineEstablished !== true || !Number.isFinite(baseline) || baseline <= 0) {
        return null;
    }
    return Math.max(HIGH_BPM_THRESHOLD, baseline + HIGH_BPM_BASELINE_DELTA);
}

function shouldActivateHighBpmAlarm({
    heartRate,
    fingerDetected,
    consecutiveHighReadings,
    baselineHeartRate,
    baselineEstablished
}) {
    const bpm = Number(heartRate);
    const consecutive = Number(consecutiveHighReadings) || 0;
    const threshold = getPersonalizedHighBpmThreshold({
        baselineHeartRate,
        baselineEstablished
    });

    return fingerDetected === true &&
        threshold !== null &&
        Number.isFinite(bpm) &&
        bpm > threshold &&
        consecutive >= HIGH_BPM_CONSECUTIVE_READINGS;
}

module.exports = {
    HIGH_BPM_THRESHOLD,
    HIGH_BPM_BASELINE_DELTA,
    HIGH_BPM_CONSECUTIVE_READINGS,
    getPersonalizedHighBpmThreshold,
    shouldActivateHighBpmAlarm
};
