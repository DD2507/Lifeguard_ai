function calculateRisk(vitals, roomContext = {}) {
    const {
        heartRate,
        spo2,
        temperature
    } = vitals;

    const {
        temperature: roomTemperature = 0,
        humidity = 0,
        airQuality = 0
    } = roomContext;

    const reasons = [];
    let score = 0;

    // ==================================================
    // HEART RATE
    // ==================================================

    if (heartRate < 50 || heartRate > 120) {
        score += 0.30;

        reasons.push({
            factor: "Heart Rate",
            value: heartRate,
            severity: "HIGH",
            explanation:
                `Heart rate of ${heartRate} BPM is outside the configured safe monitoring range.`
        });

    } else if (heartRate < 60 || heartRate > 100) {
        score += 0.15;

        reasons.push({
            factor: "Heart Rate",
            value: heartRate,
            severity: "MODERATE",
            explanation:
                `Heart rate of ${heartRate} BPM is outside the normal monitoring range and contributes to the risk assessment.`
        });
    }


    // ==================================================
    // SpO2
    // ==================================================

    if (spo2 < 90) {
        score += 0.45;

        reasons.push({
            factor: "SpO₂",
            value: spo2,
            severity: "HIGH",
            explanation:
                `SpO₂ of ${spo2}% is significantly below the configured monitoring threshold.`
        });

    } else if (spo2 < 94) {
        score += 0.30;

        reasons.push({
            factor: "SpO₂",
            value: spo2,
            severity: "MODERATE",
            explanation:
                `SpO₂ of ${spo2}% is below the configured monitoring threshold and contributes to the risk assessment.`
        });
    }


    // ==================================================
    // PATIENT TEMPERATURE
    // ==================================================

    if (temperature >= 39) {
        score += 0.30;

        reasons.push({
            factor: "Temperature",
            value: temperature,
            severity: "HIGH",
            explanation:
                `Temperature of ${temperature}°C is significantly elevated.`
        });

    } else if (temperature >= 38) {
        score += 0.20;

        reasons.push({
            factor: "Temperature",
            value: temperature,
            severity: "MODERATE",
            explanation:
                `Temperature of ${temperature}°C is elevated and contributes to the risk assessment.`
        });
    }


    // ==================================================
    // ROOM TEMPERATURE
    // ==================================================

    if (roomTemperature > 30) {
        score += 0.10;

        reasons.push({
            factor: "Room Temperature",
            value: roomTemperature,
            severity: "MODERATE",
            explanation:
                `Room temperature of ${roomTemperature}°C provides an additional environmental risk factor.`
        });
    }


    // ==================================================
    // ROOM HUMIDITY
    // ==================================================

    if (humidity > 70) {
        score += 0.05;

        reasons.push({
            factor: "Room Humidity",
            value: humidity,
            severity: "MODERATE",
            explanation:
                `Room humidity of ${humidity}% is elevated and contributes environmental context.`
        });
    }


    // ==================================================
    // AIR QUALITY - MQ135
    // ==================================================
    //
    // IMPORTANT:
    // MQ135 provides a sensor reading that depends on
    // the module and calibration. We treat this as an
    // environmental indicator rather than claiming that
    // the raw value represents a medical measurement.
    //
    // The current demo threshold is configurable.
    // ==================================================

    if (airQuality > 200) {
        score += 0.10;

        reasons.push({
            factor: "Air Quality",
            value: airQuality,
            severity: "MODERATE",
            explanation:
                `The MQ135 air-quality sensor reading of ${airQuality} is elevated relative to the configured monitoring range and contributes environmental context.`
        });
    }


    // ==================================================
    // LIMIT SCORE
    // ==================================================

    score = Math.min(score, 1);


    // ==================================================
    // DETERMINE RISK
    // ==================================================

    let risk = "LOW";

    if (score >= 0.60) {
        risk = "HIGH";

    } else if (score >= 0.30) {
        risk = "MODERATE";
    }


    // ==================================================
    // SUMMARY
    // ==================================================

    let riskSummary;

    if (reasons.length === 0) {

        riskSummary =
            "Current patient vitals and available room conditions are within the configured monitoring ranges.";

    } else {

        const factors = reasons
            .map(reason => reason.factor)
            .join(", ");

        riskSummary =
            `${risk} risk is associated with the following contributing factors: ${factors}.`;
    }


    // ==================================================
    // RECOMMENDED ROOM ACTION
    // ==================================================

    let recommendedAction = {
        fan: false,
        buzzer: false,
        reason: "No immediate room intervention is required."
    };


    // Environmental intervention
    if (
        roomTemperature > 30 ||
        humidity > 70 ||
        airQuality > 200
    ) {

        recommendedAction = {
            fan: true,
            buzzer: risk === "HIGH",
            reason:
                "Environmental conditions require attention. Fan activation is recommended to improve room conditions."
        };
    }


    // High patient risk
    if (risk === "HIGH") {

        recommendedAction = {
            fan:
                roomTemperature > 30 ||
                humidity > 70 ||
                airQuality > 200,

            buzzer: true,

            reason:
                "High patient risk detected. Immediate attention is recommended."
        };
    }


    // ==================================================
    // RETURN RESULT
    // ==================================================

    return {
        risk,
        riskScore: Number(score.toFixed(2)),
        riskReasons: reasons,
        riskSummary,
        recommendedAction
    };
}


module.exports = {
    calculateRisk
};