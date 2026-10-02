const test = require("node:test");
const assert = require("node:assert/strict");

const {
    HIGH_BPM_CONSECUTIVE_READINGS,
    shouldActivateHighBpmAlarm
} = require("./heartRateActuatorPolicy");

test("activates the physical alarm only after five consecutive readings above 100 BPM", () => {
    assert.equal(HIGH_BPM_CONSECUTIVE_READINGS, 5);
    assert.equal(shouldActivateHighBpmAlarm({
        heartRate: 104,
        fingerDetected: true,
        consecutiveHighReadings: 1,
        baselineHeartRate: 80,
        baselineEstablished: true
    }), false);
    assert.equal(shouldActivateHighBpmAlarm({
        heartRate: 106,
        fingerDetected: true,
        consecutiveHighReadings: 2,
        baselineHeartRate: 80,
        baselineEstablished: true
    }), false);
    assert.equal(shouldActivateHighBpmAlarm({
        heartRate: 108,
        fingerDetected: true,
        consecutiveHighReadings: 5,
        baselineHeartRate: 80,
        baselineEstablished: true
    }), true);
});

test("does not activate without finger contact or for a normal current reading", () => {
    assert.equal(shouldActivateHighBpmAlarm({
        heartRate: 108,
        fingerDetected: false,
        consecutiveHighReadings: 5,
        baselineHeartRate: 80,
        baselineEstablished: true
    }), false);
    assert.equal(shouldActivateHighBpmAlarm({
        heartRate: 99,
        fingerDetected: true,
        consecutiveHighReadings: 5,
        baselineHeartRate: 80,
        baselineEstablished: true
    }), false);
    assert.equal(shouldActivateHighBpmAlarm({
        heartRate: 130,
        fingerDetected: true,
        consecutiveHighReadings: 5,
        baselineHeartRate: null,
        baselineEstablished: false
    }), false);
});

test("raises the high-BPM threshold when the saved baseline is above 85 BPM", () => {
    assert.equal(shouldActivateHighBpmAlarm({
        heartRate: 108,
        fingerDetected: true,
        consecutiveHighReadings: 5,
        baselineHeartRate: 95,
        baselineEstablished: true
    }), false);
    assert.equal(shouldActivateHighBpmAlarm({
        heartRate: 111,
        fingerDetected: true,
        consecutiveHighReadings: 5,
        baselineHeartRate: 95,
        baselineEstablished: true
    }), true);
});
