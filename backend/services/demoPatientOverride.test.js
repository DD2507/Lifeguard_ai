const test = require("node:test");
const assert = require("node:assert/strict");

const {
    DEMO_SOURCE,
    DEMO_OVERRIDE_LEASE_MS,
    shouldProcessPatientPacket,
    resetDemoPatientOverrides
} = require("./demoPatientOverride");

test("ignores physical packets only while the marked high-risk demo is active", () => {
    resetDemoPatientOverrides();
    const startedAt = 1_000;

    assert.equal(shouldProcessPatientPacket("P003", {
        demoSource: DEMO_SOURCE,
        demoMode: "ACTIVE",
        fingerDetected: true
    }, startedAt), true);
    assert.equal(shouldProcessPatientPacket("P003", {
        fingerDetected: false
    }, startedAt + 1_000), false);
    assert.equal(shouldProcessPatientPacket("P007", {
        fingerDetected: false
    }, startedAt + 1_000), true);
    assert.equal(shouldProcessPatientPacket("P003", {
        fingerDetected: false
    }, startedAt + DEMO_OVERRIDE_LEASE_MS + 1), true);
});

test("the marked stop packet clears the demo override immediately", () => {
    resetDemoPatientOverrides();
    assert.equal(shouldProcessPatientPacket("P003", {
        demoSource: DEMO_SOURCE,
        demoMode: "ACTIVE"
    }, 1_000), true);
    assert.equal(shouldProcessPatientPacket("P003", {
        demoSource: DEMO_SOURCE,
        demoMode: "STOP"
    }, 2_000), true);
    assert.equal(shouldProcessPatientPacket("P003", {
        fingerDetected: false
    }, 2_001), true);
});
