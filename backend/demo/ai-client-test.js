require("dotenv").config();

const { predictWithAI } = require("../services/aiClient");

async function test() {
    try {
        const result = await predictWithAI(
            {
                heartRate: 105,
                spo2: 92,
                temperature: 38.2
            },
            {
                temperature: 32,
                humidity: 75,
                airQuality: 220
            },
            {
                heartRate: 26.5,
                spo2: -5.3,
                temperature: 1.4
            }
        );

        console.log(
            JSON.stringify(result, null, 2)
        );

    } catch (error) {
        console.error(error.message);
    }
}

test();