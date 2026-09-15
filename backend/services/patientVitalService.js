const Patient = require("../models/Patient");
const Vital = require("../models/Vital");
const Room = require("../models/room");
const Alert = require("../models/Alert");

const { predictWithAI } = require("./aiClient");

const {
    BASELINE_SAMPLE_COUNT,
    addSample,
    calculateBaseline,
    calculateDeviation
} = require("./baselineService");

async function processPatientVital(patientId, vitals) {
    const {
        heartRate,
        spo2,
        temperature
    } = vitals;

    if (
        heartRate === undefined ||
        spo2 === undefined ||
        temperature === undefined
    ) {
        throw new Error(
            "heartRate, spo2 and temperature are required"
        );
    }

    const patient = await Patient.findOne({
        patientId
    });

    if (!patient) {
        throw new Error("Patient not found");
    }

    const room = await Room.findOne({
        roomId: patient.room
    });

    const roomContext = room
        ? {
            temperature: room.temperature,
            humidity: room.humidity,
            airQuality: room.airQuality,
            presenceDetected: room.presenceDetected
        }
        : {};

    if (!patient.baseline.established) {

        const baselineStatus = addSample(
            patientId,
            {
                heartRate,
                spo2,
                temperature
            }
        );

        patient.heartRate = heartRate;
        patient.spo2 = spo2;
        patient.temperature = temperature;
        patient.roomContext = roomContext;

        patient.baseline.sampleCount =
            baselineStatus.samplesCollected;

        if (baselineStatus.established) {

            const calculatedBaseline =
                calculateBaseline(patientId);

            patient.baseline.heartRate =
                calculatedBaseline.heartRate;

            patient.baseline.spo2 =
                calculatedBaseline.spo2;

            patient.baseline.temperature =
                calculatedBaseline.temperature;

            patient.baseline.established = true;

            patient.baselineDeviation = {
                heartRate: 0,
                spo2: 0,
                temperature: 0
            };

            await patient.save();

            return {
                baselineStatus: "ESTABLISHED",
                baseline: patient.baseline,
                baselineDeviation:
                    patient.baselineDeviation,
                patient
            };
        }

        await patient.save();

        return {
            baselineStatus: "COLLECTING",
            baseline: {
                established: false,
                sampleCount:
                    baselineStatus.samplesCollected,
                requiredSamples:
                    BASELINE_SAMPLE_COUNT
            },
            patient
        };
    }

    const baselineDeviation =
        calculateDeviation(
            {
                heartRate,
                spo2,
                temperature
            },
            patient.baseline
        );

    const riskResult = await predictWithAI(
    {
        heartRate,
        spo2,
        temperature
    },
    roomContext,
    baselineDeviation
);
    patient.heartRate = heartRate;
    patient.spo2 = spo2;
    patient.temperature = temperature;

    patient.baselineDeviation =
        baselineDeviation;

    patient.risk = riskResult.risk;
    patient.riskScore =
        riskResult.riskScore;

    patient.riskReasons =
        riskResult.riskReasons;

    patient.riskSummary =
        riskResult.riskSummary;

    patient.recommendedAction =
        riskResult.recommendedAction;

    patient.roomContext =
        roomContext;

    await patient.save();

    const vital = await Vital.create({
        patientId:
            patient.patientId,

        room:
            patient.room,

        heartRate,

        spo2,

        temperature,

        baselineDeviation,

        risk:
            riskResult.risk,

        riskScore:
            riskResult.riskScore,

        riskReasons:
            riskResult.riskReasons,

        riskSummary:
            riskResult.riskSummary,

        recommendedAction:
            riskResult.recommendedAction
    });

    if (
        riskResult.risk === "HIGH" ||
        riskResult.risk === "MODERATE"
    ) {

        const existingAlert =
            await Alert.findOne({
                patientId:
                    patient.patientId,

                status: "ACTIVE"
            });

        if (existingAlert) {

            existingAlert.risk =
                riskResult.risk;

            existingAlert.riskScore =
                riskResult.riskScore;

            existingAlert.reasons =
                riskResult.riskReasons;

            existingAlert.summary =
                riskResult.riskSummary;

            existingAlert.recommendedAction =
                riskResult.recommendedAction;

            existingAlert.room =
                patient.room;

            await existingAlert.save();

        } else {

            await Alert.create({
                patientId:
                    patient.patientId,

                patientName:
                    patient.name,

                room:
                    patient.room,

                risk:
                    riskResult.risk,

                riskScore:
                    riskResult.riskScore,

                reasons:
                    riskResult.riskReasons,

                summary:
                    riskResult.riskSummary,

                recommendedAction:
                    riskResult.recommendedAction,

                status: "ACTIVE"
            });
        }

    } else {

        await Alert.updateMany(
            {
                patientId:
                    patient.patientId,

                status: "ACTIVE"
            },
            {
                status: "RESOLVED",

                resolvedAt:
                    new Date()
            }
        );
    }

    return {
        baselineStatus: "ESTABLISHED",

        baseline:
            patient.baseline,

        baselineDeviation,

        patient,

        vital,

        risk: riskResult
    };
}

module.exports = {
    processPatientVital
};