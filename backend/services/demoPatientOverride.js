const DEMO_SOURCE = "server/demo_high_risk";
const DEMO_OVERRIDE_LEASE_MS = 10_000;
const activeUntilByPatient = new Map();

function shouldProcessPatientPacket(patientId, payload, now = Date.now()) {
    const source = payload?.demoSource;
    const mode = String(payload?.demoMode || "").toUpperCase();

    if (source === DEMO_SOURCE) {
        if (mode === "STOP") {
            activeUntilByPatient.delete(patientId);
        } else {
            activeUntilByPatient.set(patientId, now + DEMO_OVERRIDE_LEASE_MS);
        }
        return true;
    }

    const activeUntil = activeUntilByPatient.get(patientId) || 0;
    if (activeUntil > now) return false;
    if (activeUntil) activeUntilByPatient.delete(patientId);
    return true;
}

function resetDemoPatientOverrides() {
    activeUntilByPatient.clear();
}

module.exports = {
    DEMO_SOURCE,
    DEMO_OVERRIDE_LEASE_MS,
    shouldProcessPatientPacket,
    resetDemoPatientOverrides
};
