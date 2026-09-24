const express = require("express");

const Patient = require("../models/Patient");
const Vital = require("../models/Vital");
const Room = require("../models/room");

const {
    resetBaseline
} = require("../services/baselineService");

const { predictWithAI } = require("../services/aiClient");

const {
    computeBaselineFromHistory,
    calculateTrend,
    buildScenarioState,
    normalizeNumber,
    resolveScenario
} = require("../services/digitalTwinService");

const router = express.Router();

function buildRoomContext(roomDocument) {
    if (!roomDocument) {
        return {
            temperature: 24,
            humidity: 50,
            airQuality: 100,
            presenceDetected: false
        };
    }

    return {
        temperature: Number(roomDocument.temperature ?? 24),
        humidity: Number(roomDocument.humidity ?? 50),
        airQuality: Number(roomDocument.airQuality ?? 100),
        presenceDetected: !!roomDocument.presenceDetected
    };
}

function buildDeviationValues(currentState, baseline) {
    return {
        heartRate:
            baseline && baseline.heartRate != null
                ? Number(
                    (currentState.heartRate - baseline.heartRate).toFixed(2)
                )
                : null,

        spo2:
            baseline && baseline.spo2 != null
                ? Number(
                    (currentState.spo2 - baseline.spo2).toFixed(2)
                )
                : null,

        temperature:
            baseline && baseline.temperature != null
                ? Number(
                    (currentState.temperature - baseline.temperature).toFixed(2)
                )
                : null
    };
}

function buildAiFeatureVector(state, roomContext, baseline) {
    const deviations = buildDeviationValues(state, baseline);

    return {
        heartRate: Number(state.heartRate),
        spo2: Number(state.spo2),
        temperature: Number(state.temperature),
        roomTemperature: Number(roomContext.temperature ?? 24),
        humidity: Number(roomContext.humidity ?? 50),
        airQuality: Number(roomContext.airQuality ?? 100),
        hrDeviation: deviations.heartRate ?? 0,
        spo2Deviation: deviations.spo2 ?? 0,
        tempDeviation: deviations.temperature ?? 0
    };
}


// CREATE PATIENT
router.post("/", async (req, res) => {
    try {
        const { patientId, name, room } = req.body;

        if (!patientId || !name || !room) {
            return res.status(400).json({
                error: "patientId, name and room are required"
            });
        }

        const existingPatient = await Patient.findOne({ patientId });

        if (existingPatient) {
            return res.status(409).json({
                error: "Patient already exists"
            });
        }

        const patient = await Patient.create({
            patientId,
            name,
            room
        });

        res.status(201).json(patient);
    } catch (error) {
        console.error("Failed to create patient:", error);

        res.status(500).json({
            error: "Failed to create patient"
        });
    }
});


// RESET PATIENT BASELINE
router.post("/:id/baseline/reset", async (req, res) => {
    try {
        const patient = await Patient.findOne({
            patientId: req.params.id
        });

        if (!patient) {
            return res.status(404).json({
                error: "Patient not found"
            });
        }

        resetBaseline(patient.patientId);

        patient.baseline = {
            heartRate: null,
            spo2: null,
            temperature: null,
            sampleCount: 0,
            established: false
        };

        patient.heartRate = null;
        patient.spo2 = null;
        patient.temperature = null;

        patient.risk = "LOW";
        patient.riskScore = 0;
        patient.riskReasons = [];
        patient.riskSummary = "";

        patient.recommendedAction = {
            fan: false,
            buzzer: false,
            reason: ""
        };

        patient.baselineDeviation = {
            heartRate: null,
            spo2: null,
            temperature: null
        };

        await patient.save();

        res.json({
            message: "Patient baseline reset successfully",
            patientId: patient.patientId,
            baseline: patient.baseline,
            baselineDeviation: patient.baselineDeviation
        });
    } catch (error) {
        console.error("Failed to reset patient baseline:", error);

        res.status(500).json({
            error: "Failed to reset patient baseline"
        });
    }
});


// GET DIGITAL TWIN
router.get("/:patientId/digital-twin", async (req, res) => {
    try {
        const patient = await Patient.findOne({
            patientId: req.params.patientId
        });

        if (!patient) {
            return res.status(404).json({
                error: "Patient not found"
            });
        }

        const history = await Vital.find({
            patientId: patient.patientId
        })
            .sort({ createdAt: -1 })
            .limit(100)
            .lean();

        const latestVital = history[0] || null;

        const currentState = {
            heartRate: normalizeNumber(
                latestVital?.heartRate ?? patient.heartRate,
                patient.heartRate ?? 0
            ),

            spo2: normalizeNumber(
                latestVital?.spo2 ?? patient.spo2,
                patient.spo2 ?? 100
            ),

            temperature: normalizeNumber(
                latestVital?.temperature ?? patient.temperature,
                patient.temperature ?? 36.8
            ),

            roomTemperature: normalizeNumber(
                patient.roomContext?.temperature ?? 24,
                24
            ),

            humidity: normalizeNumber(
                patient.roomContext?.humidity ?? 50,
                50
            ),

            airQuality: normalizeNumber(
                patient.roomContext?.airQuality ?? 100,
                100
            )
        };

        const baselineInfo = computeBaselineFromHistory(history);
        const baseline = baselineInfo.baseline;

        const deviations = buildDeviationValues(
            currentState,
            baseline
        );

        // Only use complete, physiologically valid vital records
        // for Digital Twin trend calculations.
        //
        // This prevents old test records such as
        // HR = 0, SpO2 = 0, Temp = 27.6
        // from creating misleading trends.
        const validTrendHistory = history.filter(
            (entry) =>
                entry &&
                Number.isFinite(Number(entry.heartRate)) &&
                Number(entry.heartRate) > 0 &&
                Number.isFinite(Number(entry.spo2)) &&
                Number(entry.spo2) > 0 &&
                Number.isFinite(Number(entry.temperature)) &&
                Number(entry.temperature) > 0
        );

        const trends = {
            heartRate: calculateTrend(
                validTrendHistory.map((entry) => entry.heartRate),
                "heartRate"
            ),

            spo2: calculateTrend(
                validTrendHistory.map((entry) => entry.spo2),
                "spo2"
            ),

            temperature: calculateTrend(
                validTrendHistory.map((entry) => entry.temperature),
                "temperature"
            )
        };

        const dataQuality = {
            status: baselineInfo.status,
            message: baselineInfo.message,
            sampleCount: baselineInfo.sampleCount,
            requiredSamples: baselineInfo.requiredSamples
        };

        res.json({
            patient: {
                patientId: patient.patientId,
                name: patient.name,
                room: patient.room,
                risk: patient.risk,
                riskScore: patient.riskScore,
                source: patient.riskSummary
                    ? "Live monitoring"
                    : "No live risk summary"
            },

            currentState,
            baseline,
            deviations,
            trends,
            dataQuality,

            simulationOnly: false,

            note: "This patient-specific digital twin is derived from the patient’s real historical vitals and current state only."
        });

    } catch (error) {
        console.error("Failed to fetch digital twin:", error);

        res.status(500).json({
            error: "Failed to fetch digital twin"
        });
    }
});


// WHAT-IF SIMULATION
router.post("/:patientId/what-if", async (req, res) => {
    try {
        const patient = await Patient.findOne({
            patientId: req.params.patientId
        });

        if (!patient) {
            return res.status(404).json({
                error: "Patient not found"
            });
        }

        const history = await Vital.find({
            patientId: patient.patientId
        })
            .sort({ createdAt: -1 })
            .limit(100)
            .lean();

        const latestVital = history[0] || null;

        const room = await Room.findOne({
            roomId: patient.room
        });

        const roomContext = buildRoomContext(room);

        const currentState = {
            heartRate: normalizeNumber(
                latestVital?.heartRate ?? patient.heartRate,
                patient.heartRate ?? 0
            ),

            spo2: normalizeNumber(
                latestVital?.spo2 ?? patient.spo2,
                patient.spo2 ?? 100
            ),

            temperature: normalizeNumber(
                latestVital?.temperature ?? patient.temperature,
                patient.temperature ?? 36.8
            ),

            roomTemperature: normalizeNumber(
                roomContext.temperature,
                24
            ),

            humidity: normalizeNumber(
                roomContext.humidity,
                50
            ),

            airQuality: normalizeNumber(
                roomContext.airQuality,
                100
            )
        };

        const baselineInfo = computeBaselineFromHistory(history);
        const baseline = baselineInfo.baseline;

        const currentRiskPayload = buildAiFeatureVector(
            currentState,
            roomContext,
            baseline
        );

        const currentRisk = await predictWithAI(
            currentRiskPayload,
            roomContext,
            buildDeviationValues(currentState, baseline)
        );

        const request = req.body || {};
        const manualOverrides = {};

        [
            "heartRate",
            "spo2",
            "temperature",
            "roomTemperature",
            "humidity",
            "airQuality"
        ].forEach((key) => {
            if (request[key] !== undefined) {
                const value = Number(request[key]);

                if (!Number.isFinite(value)) {
                    throw new Error(`Invalid value for ${key}`);
                }

                manualOverrides[key] = value;
            }
        });

        let scenario = {
            id: "MANUAL",
            name: "Manual Simulation",
            description:
                "Simulation built from clinician-entered virtual values."
        };

        if (request.scenario) {
            const matchedScenario = resolveScenario(
                request.scenario
            );

            if (!matchedScenario) {
                return res.status(400).json({
                    error: "Unknown scenario",
                    validScenarios: Object.keys(
                        require("../services/digitalTwinService")
                            .SCENARIO_LIBRARY
                    )
                });
            }

            scenario = {
                id: matchedScenario.id,
                name: matchedScenario.name,
                description: matchedScenario.description
            };
        }

        const simulatedState = request.scenario
            ? buildScenarioState(
                request.scenario,
                currentState,
                baseline
            )
            : {
                ...currentState,
                ...manualOverrides
            };

        if (
            Object.keys(manualOverrides).length > 0 &&
            request.scenario
        ) {
            Object.assign(
                simulatedState,
                manualOverrides
            );
        }

        const simulatedBaseline =
            baselineInfo.status === "SUFFICIENT"
                ? baseline
                : {
                    heartRate: null,
                    spo2: null,
                    temperature: null
                };

        const simulatedDeviations =
            buildDeviationValues(
                simulatedState,
                simulatedBaseline
            );

        const simulatedRiskPayload =
            buildAiFeatureVector(
                simulatedState,
                {
                    ...roomContext,
                    temperature:
                        simulatedState.roomTemperature ??
                        roomContext.temperature,
                    humidity:
                        simulatedState.humidity ??
                        roomContext.humidity,
                    airQuality:
                        simulatedState.airQuality ??
                        roomContext.airQuality
                },
                simulatedBaseline
            );

        const simulatedRisk = await predictWithAI(
            simulatedRiskPayload,
            {
                ...roomContext,
                temperature:
                    simulatedState.roomTemperature ??
                    roomContext.temperature,
                humidity:
                    simulatedState.humidity ??
                    roomContext.humidity,
                airQuality:
                    simulatedState.airQuality ??
                    roomContext.airQuality
            },
            simulatedDeviations
        );

        const comparison = {
            heartRateDelta: Number(
                (
                    simulatedState.heartRate -
                    currentState.heartRate
                ).toFixed(2)
            ),

            spo2Delta: Number(
                (
                    simulatedState.spo2 -
                    currentState.spo2
                ).toFixed(2)
            ),

            temperatureDelta: Number(
                (
                    simulatedState.temperature -
                    currentState.temperature
                ).toFixed(2)
            ),

            riskChanged:
                currentRisk.risk !== simulatedRisk.risk,

            currentRisk: currentRisk.risk,

            simulatedRisk: simulatedRisk.risk,

            scoreDelta: Number(
                (
                    simulatedRisk.riskScore -
                    currentRisk.riskScore
                ).toFixed(2)
            )
        };

        res.json({
            patient: {
                patientId: patient.patientId,
                name: patient.name,
                room: patient.room
            },

            scenario,

            currentState,

            simulatedState,

            baseline:
                baselineInfo.status === "SUFFICIENT"
                    ? baseline
                    : {
                        heartRate:
                            baseline?.heartRate ?? null,
                        spo2:
                            baseline?.spo2 ?? null,
                        temperature:
                            baseline?.temperature ?? null
                    },

            deviations: simulatedDeviations,

            currentRisk: {
                risk: currentRisk.risk,
                riskScore: currentRisk.riskScore,
                riskSummary: currentRisk.riskSummary,
                recommendedAction:
                    currentRisk.recommendedAction
            },

            simulatedRisk: {
                risk: simulatedRisk.risk,
                riskScore: simulatedRisk.riskScore,
                riskReasons: simulatedRisk.riskReasons,
                riskSummary: simulatedRisk.riskSummary,
                recommendedAction:
                    simulatedRisk.recommendedAction
            },

            comparison,

            dataQuality: {
                status: baselineInfo.status,
                message: baselineInfo.message,
                sampleCount: baselineInfo.sampleCount,
                requiredSamples:
                    baselineInfo.requiredSamples
            },

            simulationOnly: true,

            note: "Simulation only — this estimates how physiological indicators and the AI risk score could change under the selected scenario. It does not predict an actual clinical outcome or provide a diagnosis."
        });

    } catch (error) {
        console.error(
            "Failed to simulate what-if scenario:",
            error
        );

        const status =
            error.message === "Unknown scenario" ||
            error.message.startsWith("Invalid value")
                ? 400
                : 500;

        res.status(status).json({
            error: error.message,
            simulationOnly: true
        });
    }
});


// GET ALL PATIENTS
router.get("/", async (req, res) => {
    try {
        const patients = await Patient.find();

        const patientsWithStatus = patients.map(
            (patient) => {
                const patientData = patient.toObject();

                if (!patientData.baseline?.established) {
                    return {
                        ...patientData,

                        risk: "LOW",
                        riskScore: 0,
                        riskReasons: [],

                        riskSummary:
                            "Baseline is currently being established.",

                        recommendedAction: {
                            fan: false,
                            buzzer: false,
                            reason:
                                "Baseline collection in progress."
                        }
                    };
                }

                return patientData;
            }
        );

        res.json(patientsWithStatus);

    } catch (error) {
        console.error(
            "Failed to fetch patients:",
            error
        );

        res.status(500).json({
            error: "Failed to fetch patients"
        });
    }
});


// GET SINGLE PATIENT
router.get("/:id", async (req, res) => {
    try {
        const patient = await Patient.findOne({
            patientId: req.params.id
        });

        if (!patient) {
            return res.status(404).json({
                error: "Patient not found"
            });
        }

        const patientData = patient.toObject();

        if (!patientData.baseline?.established) {
            return res.json({
                ...patientData,

                risk: "LOW",
                riskScore: 0,
                riskReasons: [],

                riskSummary:
                    "Baseline is currently being established.",

                recommendedAction: {
                    fan: false,
                    buzzer: false,
                    reason:
                        "Baseline collection in progress."
                }
            });
        }

        res.json(patientData);

    } catch (error) {
        console.error(
            "Failed to fetch patient:",
            error
        );

        res.status(500).json({
            error: "Failed to fetch patient"
        });
    }
});


module.exports = router;