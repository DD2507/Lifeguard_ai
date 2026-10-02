function calculateRisk(
    vitals,
    roomContext = {},
    baselineDeviation = {}
) {
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
    const numericRoomTemperature = Number(roomTemperature);
    const roomTemperatureAvailable = Number.isFinite(numericRoomTemperature) &&
        numericRoomTemperature > 0;
    const roomTemperatureOutsideComfortRange = roomTemperatureAvailable &&
        (numericRoomTemperature < 22 || numericRoomTemperature > 28);

    const {
        heartRate: hrDeviation = null,
        spo2: spo2Deviation = null,
        temperature: tempDeviation = null
    } = baselineDeviation;

    const reasons = [];

    let score = 0;
    let absoluteHeartRateFlagged = false;
    let absoluteSpo2Flagged = false;
    let absoluteTemperatureFlagged = false;

    // ==================================================
    // HEART RATE
    // ==================================================

    if (heartRate < 50 || heartRate > 120) {
        score += 0.60;
        absoluteHeartRateFlagged = true;

        reasons.push({
            factor: "Heart Rate",
            value: heartRate,
            severity: "HIGH",
            explanation:
                `Resting heart rate of ${heartRate} BPM is markedly outside the general adult 60-100 BPM reference range and requires prompt verification.`
        });

    } else if (heartRate < 60 || heartRate > 100) {
        score += 0.15;
        absoluteHeartRateFlagged = true;

        reasons.push({
            factor: "Heart Rate",
            value: heartRate,
            severity: "MODERATE",
            explanation:
                `Resting heart rate of ${heartRate} BPM is outside the general adult 60-100 BPM reference range.`
        });
    }

    // ==================================================
    // SpO2
    // ==================================================

    if (spo2 < 90) {
        score += 0.60;
        absoluteSpo2Flagged = true;

        reasons.push({
            factor: "SpO₂",
            value: spo2,
            severity: "HIGH",
            explanation:
                `SpO₂ of ${spo2}% is below 90%; verify the sensor reading promptly and seek clinical review if confirmed.`
        });

    } else if (spo2 < 94) {
        score += 0.30;
        absoluteSpo2Flagged = true;

        reasons.push({
            factor: "SpO₂",
            value: spo2,
            severity: "MODERATE",
            explanation:
                `SpO₂ of ${spo2}% is below the general 95-100% reference range and should be rechecked.`
        });
    }

    // ==================================================
    // PATIENT TEMPERATURE
    // ==================================================

    if (temperature < 32) {
        score += 0.60;
        absoluteTemperatureFlagged = true;

        reasons.push({
            factor: "Temperature",
            value: temperature,
            severity: "HIGH",
            explanation:
                `Reported body temperature is ${temperature}°C. If confirmed as a core/body reading, this is severely low; verify sensor contact and measurement method immediately.`
        });

    } else if (temperature < 34) {
        score += 0.30;
        absoluteTemperatureFlagged = true;

        reasons.push({
            factor: "Temperature",
            value: temperature,
            severity: "MODERATE",
            explanation:
                `Reported body temperature is ${temperature}°C, below the prototype sensor's accepted 34°C minimum; verify sensor contact and measurement method.`
        });

    } else if (temperature >= 39) {
        score += 0.30;
        absoluteTemperatureFlagged = true;

        reasons.push({
            factor: "Temperature",
            value: temperature,
            severity: "HIGH",
            explanation:
                `Reported body temperature is ${temperature}°C, which is markedly elevated and should be clinically reviewed if confirmed.`
        });

    } else if (temperature >= 38) {
        score += 0.20;
        absoluteTemperatureFlagged = true;

        reasons.push({
            factor: "Temperature",
            value: temperature,
            severity: "MODERATE",
            explanation:
                `Reported body temperature is ${temperature}°C, meeting the common adult fever threshold.`
        });
    }

    // ==================================================
    // PERSONAL BASELINE DEVIATION
    // ==================================================

    if (hrDeviation !== null && !absoluteHeartRateFlagged) {

        if (Math.abs(hrDeviation) >= 25) {
            score += 0.15;

            reasons.push({
                factor: "Heart Rate Deviation",
                value: hrDeviation,
                severity: "HIGH",
                explanation:
                    `Heart rate differs from the patient's personal baseline by ${hrDeviation} BPM.`
            });

        } else if (Math.abs(hrDeviation) >= 15) {
            score += 0.08;

            reasons.push({
                factor: "Heart Rate Deviation",
                value: hrDeviation,
                severity: "MODERATE",
                explanation:
                    `Heart rate differs from the patient's personal baseline by ${hrDeviation} BPM.`
            });
        }
    }

    if (spo2Deviation !== null && !absoluteSpo2Flagged) {

        if (spo2Deviation <= -4) {
            score += 0.20;

            reasons.push({
                factor: "SpO₂ Baseline Deviation",
                value: spo2Deviation,
                severity: "HIGH",
                explanation:
                    `SpO₂ has fallen ${Math.abs(spo2Deviation)} percentage points below the patient's personal baseline.`
            });

        } else if (spo2Deviation <= -2) {
            score += 0.10;

            reasons.push({
                factor: "SpO₂ Baseline Deviation",
                value: spo2Deviation,
                severity: "MODERATE",
                explanation:
                    `SpO₂ has fallen ${Math.abs(spo2Deviation)} percentage points below the patient's personal baseline.`
            });
        }
    }

    if (tempDeviation !== null && !absoluteTemperatureFlagged) {

        if (tempDeviation >= 1.5) {
            score += 0.15;

            reasons.push({
                factor: "Temperature Baseline Deviation",
                value: tempDeviation,
                severity: "HIGH",
                explanation:
                    `Body temperature is ${tempDeviation}°C above the patient's personal baseline.`
            });

        } else if (tempDeviation >= 0.8) {
            score += 0.08;

            reasons.push({
                factor: "Temperature Baseline Deviation",
                value: tempDeviation,
                severity: "MODERATE",
                explanation:
                    `Body temperature is ${tempDeviation}°C above the patient's personal baseline.`
            });
        } else if (tempDeviation <= -1.5) {
            score += 0.15;

            reasons.push({
                factor: "Temperature Baseline Deviation",
                value: tempDeviation,
                severity: "HIGH",
                explanation:
                    `Body temperature is ${Math.abs(tempDeviation)}°C below the patient's personal baseline.`
            });

        } else if (tempDeviation <= -0.8) {
            score += 0.08;

            reasons.push({
                factor: "Temperature Baseline Deviation",
                value: tempDeviation,
                severity: "MODERATE",
                explanation:
                    `Body temperature is ${Math.abs(tempDeviation)}°C below the patient's personal baseline.`
            });
        }
    }

    // ==================================================
    // ROOM TEMPERATURE
    // ==================================================

    if (roomTemperatureOutsideComfortRange) {
        score += 0.10;

        reasons.push({
            factor: "Room Temperature",
            value: roomTemperature,
            severity: "MODERATE",
            explanation:
                `Room temperature of ${roomTemperature}°C is outside the configured 22–28°C comfort range; it is environmental context, not a diagnosis.`
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
    // AIR QUALITY
    // ==================================================

    if (airQuality > 200) {
        score += 0.10;

        reasons.push({
            factor: "Air Quality",
            value: airQuality,
            severity: "MODERATE",
            explanation:
                `Raw MQ135 reading ${airQuality} exceeds the prototype device threshold of 200. This is not calibrated AQI or a pollutant concentration.`
        });
    }

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
            "Current patient vitals, personal baseline comparison and available room conditions are within the configured monitoring ranges.";
    } else {
        const factors = reasons
            .map(reason => reason.factor)
            .join(", ");

        riskSummary =
            `${risk} risk is associated with the following contributing factors: ${factors}.`;
    }

    // ==================================================
    // RECOMMENDED ROOM RESPONSE
    // ==================================================

    let recommendedAction = {
        fan: false,
        buzzer: false,
        reason: "No immediate room intervention is required."
    };

    if (
        roomTemperatureOutsideComfortRange ||
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

    if (risk === "HIGH") {
        recommendedAction = {
            fan:
                roomTemperatureOutsideComfortRange ||
                humidity > 70 ||
                airQuality > 200,

            buzzer: true,

            reason:
                "High patient risk detected. Immediate attention is recommended."
        };
    }

    return {
        risk,

        riskScore:
            Number(score.toFixed(2)),

        riskReasons:
            reasons,

        riskSummary,

        recommendedAction
    };
}

module.exports = {
    calculateRisk
};
