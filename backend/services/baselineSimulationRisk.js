function calculateBaselineSimulationRisk(state, baseline) {
    const deviations = {
        heartRate: Number((Number(state.heartRate) - Number(baseline.heartRate)).toFixed(2)),
        spo2: Number((Number(state.spo2) - Number(baseline.spo2)).toFixed(2)),
        temperature: Number((Number(state.temperature) - Number(baseline.temperature)).toFixed(2))
    };
    const reasons = [];
    let score = 0;

    const addReason = (factor, value, severity, contribution, explanation) => {
        score += contribution;
        reasons.push({ factor, value, severity, contribution, explanation });
    };

    const absoluteHrDeviation = Math.abs(deviations.heartRate);
    if (absoluteHrDeviation >= 25) {
        addReason(
            "Heart Rate Baseline Deviation",
            deviations.heartRate,
            "HIGH",
            0.6,
            `Simulated heart rate is ${absoluteHrDeviation} BPM ${deviations.heartRate >= 0 ? "above" : "below"} the saved personal baseline.`
        );
    } else if (absoluteHrDeviation >= 15) {
        addReason(
            "Heart Rate Baseline Deviation",
            deviations.heartRate,
            "MODERATE",
            0.3,
            `Simulated heart rate is ${absoluteHrDeviation} BPM ${deviations.heartRate >= 0 ? "above" : "below"} the saved personal baseline.`
        );
    }

    if (deviations.spo2 <= -5) {
        addReason(
            "SpO₂ Baseline Deviation",
            deviations.spo2,
            "HIGH",
            0.6,
            `Simulated SpO₂ is ${Math.abs(deviations.spo2)} percentage points below the saved personal baseline.`
        );
    } else if (deviations.spo2 <= -3) {
        addReason(
            "SpO₂ Baseline Deviation",
            deviations.spo2,
            "MODERATE",
            0.3,
            `Simulated SpO₂ is ${Math.abs(deviations.spo2)} percentage points below the saved personal baseline.`
        );
    }

    const absoluteTemperatureDeviation = Math.abs(deviations.temperature);
    if (absoluteTemperatureDeviation >= 2) {
        addReason(
            "Temperature Baseline Deviation",
            deviations.temperature,
            "HIGH",
            0.6,
            `Simulated body temperature is ${absoluteTemperatureDeviation}°C ${deviations.temperature >= 0 ? "above" : "below"} the saved personal baseline.`
        );
    } else if (absoluteTemperatureDeviation >= 1) {
        addReason(
            "Temperature Baseline Deviation",
            deviations.temperature,
            "MODERATE",
            0.3,
            `Simulated body temperature is ${absoluteTemperatureDeviation}°C ${deviations.temperature >= 0 ? "above" : "below"} the saved personal baseline.`
        );
    }

    score = Number(Math.min(score, 1).toFixed(2));
    const risk = score >= 0.6 ? "HIGH" : score >= 0.3 ? "MODERATE" : "LOW";
    const riskSummary = reasons.length
        ? `${risk} baseline-relative risk. The simulated readings differ materially from the saved personal baseline.`
        : "LOW baseline-relative risk. The simulated readings remain close to the saved personal baseline.";

    return {
        risk,
        riskScore: score,
        riskReasons: reasons,
        riskSummary,
        recommendedAction: {
            fan: false,
            buzzer: false,
            reason: "Simulation only; no physical actuator command is generated."
        },
        deviations
    };
}

module.exports = { calculateBaselineSimulationRisk };
