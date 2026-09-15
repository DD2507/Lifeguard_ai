const AI_SERVICE_URL =
    process.env.AI_SERVICE_URL || "http://localhost:8000";

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
    predictWithAI
};