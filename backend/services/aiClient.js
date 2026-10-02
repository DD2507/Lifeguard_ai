const AI_SERVICE_URL =
    process.env.AI_SERVICE_URL || "http://localhost:8000";

const MODEL_TRAINING_RANGES = {
    heartRate: [55, 125],
    spo2: [88, 100],
    temperature: [35.5, 39.5],
    roomTemperature: [18, 35],
    humidity: [30, 85],
    airQuality: [50, 300],
    hrDeviation: [-20, 40],
    spo2Deviation: [-10, 3],
    tempDeviation: [-1, 2.5]
};

function getModelInputIssues(vitals, roomContext, baselineDeviation) {
    const features = {
        heartRate: vitals.heartRate,
        spo2: vitals.spo2,
        temperature: vitals.temperature,
        roomTemperature: roomContext.temperature,
        humidity: roomContext.humidity,
        airQuality: roomContext.airQuality,
        hrDeviation: baselineDeviation.heartRate,
        spo2Deviation: baselineDeviation.spo2,
        tempDeviation: baselineDeviation.temperature
    };

    return Object.entries(MODEL_TRAINING_RANGES).flatMap(([feature, [minimum, maximum]]) => {
        const rawValue = features[feature];
        const value = rawValue == null || rawValue === "" ? NaN : Number(rawValue);
        if (!Number.isFinite(value)) {
            return [{ feature, value: null, minimum, maximum, reason: "missing or non-numeric" }];
        }
        if (value < minimum || value > maximum) {
            return [{ feature, value, minimum, maximum, reason: "outside model training range" }];
        }
        return [];
    });
}

function isWithinModelTrainingRanges(vitals, roomContext, baselineDeviation) {
    return getModelInputIssues(vitals, roomContext, baselineDeviation).length === 0;
}

async function predictWithAI(vitals, roomContext, baselineDeviation) {
    const response = await fetch(
        `${AI_SERVICE_URL}/api/ai/predict`,
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                heartRate: vitals.heartRate,
                spo2: vitals.spo2,
                temperature: vitals.temperature,

                roomTemperature:
                    roomContext.temperature ?? 24,

                humidity:
                    roomContext.humidity ?? 50,

                airQuality:
                    roomContext.airQuality ?? 100,

                hrDeviation:
                    baselineDeviation.heartRate ?? 0,

                spo2Deviation:
                    baselineDeviation.spo2 ?? 0,

                tempDeviation:
                    baselineDeviation.temperature ?? 0
            })
        }
    );

    if (!response.ok) {
        const errorText = await response.text();

        throw new Error(
            `AI service error ${response.status}: ${errorText}`
        );
    }

    return await response.json();
}

module.exports = {
    predictWithAI,
    MODEL_TRAINING_RANGES,
    getModelInputIssues,
    isWithinModelTrainingRanges
};
