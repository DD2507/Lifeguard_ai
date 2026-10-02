const express = require("express");

const Patient = require("../models/Patient");
const Vital = require("../models/Vital");
const Room = require("../models/room");

const {
    BASELINE_SAMPLE_COUNT,
    validateReading,
    isNormalBaselineReading,
    calculateBaseline,
    calculateDeviation
} = require("../services/baselineService");
const {
    effectiveBaselineStatus,
    getSensorStatus
} = require("../services/patientVitalService");
const { presentRoom } = require("../services/roomSensorService");

const { calculateBaselineSimulationRisk } = require("../services/baselineSimulationRisk");

const {
    computeBaselineFromHistory,
    calculateTrend,
    buildScenarioState,
    normalizeNumber,
    resolveScenario
} = require("../services/digitalTwinService");

const router = express.Router();

function presentPatient(patient, roomDocument = null) {
    const data = patient.toObject();
    const baselineStatus = effectiveBaselineStatus(patient);
    const sensorStatus = getSensorStatus(patient);
    const hasValidLiveReading = Boolean(patient.lastValidReadingAt);
    const handDetected = patient.fingerDetected === true;

    data.baselineStatus = baselineStatus;
    data.baselineRequiredSamples = BASELINE_SAMPLE_COUNT;
    data.sensorStatus = sensorStatus;

    if (roomDocument) {
        const liveRoom = presentRoom(roomDocument);
        data.roomContext = {
            temperature: liveRoom.temperature,
            humidity: liveRoom.humidity,
            airQuality: liveRoom.airQuality,
            presenceDetected: liveRoom.presenceDetected
        };
    }

    if (baselineStatus !== "ESTABLISHED") {
        const validSampleCount = (data.baseline?.calibrationSamples || [])
            .filter((sample) => validateReading(sample).valid).length;
        data.baseline = {
            ...data.baseline,
            heartRate: null,
            spo2: null,
            temperature: null,
            sampleCount: validSampleCount,
            established: false,
            calibrationStatus: "BASELINE_CALIBRATING"
        };
    }

    if (!hasValidLiveReading) {
        data.heartRate = null;
        data.spo2 = null;
        data.temperature = null;
    }

    if (!handDetected || baselineStatus !== "ESTABLISHED" || !hasValidLiveReading || sensorStatus !== "LIVE") {
        data.risk = null;
        data.riskScore = null;
        data.aiRisk = null;
        data.aiConfidence = null;
        data.aiInferenceAt = null;
        data.riskReasons = [];
        data.riskSummary = !handDetected
            ? "Hand not detected. Place a finger on the pulse-oximeter sensor to show the risk."
            : baselineStatus !== "ESTABLISHED"
                ? "Calculate the 15-reading patient baseline to show the risk."
                : sensorStatus === "SENSOR_INVALID"
                    ? `SENSOR_INVALID: ${patient.lastSensorError || "latest sensor packet failed validation"}; risk score withheld.`
                    : sensorStatus === "DATA_STALE"
                ? "DATA_STALE: no recent valid sensor packet; risk score withheld."
                        : "No valid live sensor reading has been received.";
    }

    return data;
}

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
router.post("/:patientId/baseline", async (req, res) => {
    try {
        const patient = await Patient.findOne({ patientId: req.params.patientId });
        if (!patient) {
            return res.status(404).json({ error: "Patient not found" });
        }

        const readings = req.body?.readings;
        if (
            !Array.isArray(readings) ||
            readings.length !== BASELINE_SAMPLE_COUNT
        ) {
            return res.status(400).json({
                error: `Exactly ${BASELINE_SAMPLE_COUNT} valid MQTT readings are required`
            });
        }

        const normalizedReadings = [];
        const seenTimestamps = new Set();
        for (const reading of readings) {
            const suppliedSensorStatus = String(reading?.sensorStatus || "")
                .trim()
                .toUpperCase();
            if (suppliedSensorStatus && suppliedSensorStatus !== "LIVE") {
                return res.status(400).json({
                    error: "A baseline sample was explicitly marked as a non-LIVE sensor reading"
                });
            }
            const receivedAt = reading?.receivedAt ? new Date(reading.receivedAt) : null;
            const validation = validateReading(reading);
            if (!validation.valid || !receivedAt || Number.isNaN(receivedAt.getTime())) {
                return res.status(400).json({
                    error: `All baseline samples must contain valid timestamped heart-rate, SpO2, and temperature readings${validation.reason ? `: ${validation.reason}` : ""}`
                });
            }
            const timestamp = receivedAt.toISOString();
            if (seenTimestamps.has(timestamp)) {
                return res.status(400).json({ error: "Duplicate sensor readings cannot be used for a baseline" });
            }
            seenTimestamps.add(timestamp);
            normalizedReadings.push({
                ...validation.vitals,
                receivedAt
            });
        }

        const calculatedBaseline = calculateBaseline(normalizedReadings, "mean");
        if (!calculatedBaseline) {
            return res.status(400).json({ error: "Unable to calculate a complete patient baseline from the supplied readings" });
        }

        const establishedAt = new Date();
        patient.baseline = {
            ...(patient.baseline?.toObject?.() || patient.baseline || {}),
            ...calculatedBaseline,
            sampleCount: normalizedReadings.length,
            calibrationSamples: normalizedReadings,
            establishedAt,
            baselineMethod: "mean",
            calibrationStatus: "ESTABLISHED",
            established: true
        };

        const currentReading = validateReading(patient);
        patient.baselineDeviation = getSensorStatus(patient) === "LIVE" && currentReading.valid
            ? calculateDeviation(currentReading.vitals, patient.baseline)
            : { heartRate: null, spo2: null, temperature: null };

        await patient.save();
        return res.json({
            message: "Complete patient baseline saved successfully",
            patientId: patient.patientId,
            baseline: patient.baseline,
            baselineDeviation: patient.baselineDeviation,
            baselineStatus: patient.baseline.calibrationStatus
        });
    } catch (error) {
        console.error("Failed to save patient session baseline:", error);
        return res.status(500).json({ error: "Failed to save patient session baseline" });
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

        patient.baseline = {
            heartRate: null,
            spo2: null,
            temperature: null,
            sampleCount: 0,
            calibrationStatus: "BASELINE_CALIBRATING",
            calibrationSamples: [],
            establishedAt: null,
            baselineMethod: "median",
            skippedAbnormalSamples: 0,
            established: false
        };

        patient.heartRate = null;
        patient.spo2 = null;
        patient.temperature = null;

        patient.risk = null;
        patient.riskScore = null;
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
        patient.sensorStatus = "SENSOR_DISCONNECTED";
        patient.lastSensorMessageAt = null;
        patient.lastValidReadingAt = null;
        patient.lastSensorError = "";
        patient.aiRisk = null;
        patient.aiConfidence = null;
        patient.aiInferenceAt = null;
        patient.lastRiskAssessmentAt = null;

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

        const room = await Room.findOne({ roomId: patient.room });
        const liveRoom = room ? presentRoom(room) : null;

        const history = await Vital.find({
            patientId: patient.patientId,
            source: "MQTT"
        })
            .sort({ createdAt: -1 })
            .limit(100)
            .lean();

        const currentValidation = validateReading(patient);
        const sensorStatus = getSensorStatus(patient);
        const hasLiveVitals = sensorStatus === "LIVE" && currentValidation.valid;
        const currentState = {
            heartRate: hasLiveVitals ? currentValidation.vitals.heartRate : null,
            spo2: hasLiveVitals ? currentValidation.vitals.spo2 : null,
            temperature: hasLiveVitals ? currentValidation.vitals.temperature : null,
            roomTemperature: liveRoom?.temperature ?? null,
            humidity: liveRoom?.humidity ?? null,
            airQuality: liveRoom?.airQuality ?? null
        };

        const baselineStatus = effectiveBaselineStatus(patient);
        const handDetected = patient.fingerDetected === true;
        const riskAvailable = handDetected && baselineStatus === "ESTABLISHED" && hasLiveVitals;
        const baseline = baselineStatus === "ESTABLISHED"
            ? {
                heartRate: patient.baseline.heartRate,
                spo2: patient.baseline.spo2,
                temperature: patient.baseline.temperature
            }
            : { heartRate: null, spo2: null, temperature: null };
        const deviations = baselineStatus === "ESTABLISHED" && hasLiveVitals
            ? calculateDeviation(currentValidation.vitals, { ...baseline, established: true })
            : { heartRate: null, spo2: null, temperature: null };

        const validTrendHistory = history.filter(
            (entry) =>
                entry &&
                Number.isFinite(Number(entry.heartRate)) && Number(entry.heartRate) >= 30 && Number(entry.heartRate) <= 220 &&
                Number.isFinite(Number(entry.spo2)) && Number(entry.spo2) >= 70 && Number(entry.spo2) <= 100 &&
                Number.isFinite(Number(entry.temperature)) && Number(entry.temperature) >= 25 && Number(entry.temperature) <= 45
        ).reverse();

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
            status: baselineStatus,
            sensorStatus,
            message: baselineStatus === "ESTABLISHED"
                ? patient.baseline.baselineMethod === "mean"
                    ? `Personal baseline was calculated as the arithmetic mean of ${patient.baseline.sampleCount} valid MQTT readings.`
                    : "Baseline was calibrated from valid MQTT sensor readings and is frozen until explicitly reset."
                : `BASELINE_CALIBRATING: ${patient.baseline.sampleCount}/${BASELINE_SAMPLE_COUNT} valid normal-range MQTT readings collected.`,
            sampleCount: patient.baseline.sampleCount,
            requiredSamples: BASELINE_SAMPLE_COUNT,
            baselineMethod: patient.baseline.baselineMethod || "median",
            lastValidReadingAt: patient.lastValidReadingAt,
            lastSensorMessageAt: patient.lastSensorMessageAt,
            lastSensorError: patient.lastSensorError
        };

        res.json({
            patient: {
                patientId: patient.patientId,
                name: patient.name,
                room: patient.room,
                risk: riskAvailable ? patient.risk : null,
                riskScore: riskAvailable ? patient.riskScore : null,
                aiRisk: riskAvailable ? patient.aiRisk : null,
                aiConfidence: riskAvailable ? patient.aiConfidence : null,
                aiInferenceAt: riskAvailable ? patient.aiInferenceAt : null,
                riskSummary: !handDetected
                    ? "Hand not detected. Place a finger on the pulse-oximeter sensor to show the risk."
                    : baselineStatus !== "ESTABLISHED"
                        ? "Calculate the 15-reading patient baseline to show the risk."
                        : hasLiveVitals
                    ? patient.riskSummary
                    : sensorStatus === "SENSOR_INVALID"
                        ? `SENSOR_INVALID: ${patient.lastSensorError || "latest sensor packet failed validation"}; risk assessment withheld.`
                        : `${sensorStatus}: risk assessment withheld until valid live readings resume.`,
                riskReasons: riskAvailable ? patient.riskReasons : [],
                source: riskAvailable ? "MQTT" : sensorStatus
            },

            currentState,
            baseline,
            deviations,
            trends,
            dataQuality,

            simulationOnly: false,

            note: "Live state and baseline use valid MQTT readings only. This is a university prototype, not a medically validated diagnostic system."
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

        if (effectiveBaselineStatus(patient) !== "ESTABLISHED") {
            return res.status(409).json({
                error: "Calculate the 15-reading patient baseline before running a risk simulation."
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

        const savedBaselineEstablished = effectiveBaselineStatus(patient) === "ESTABLISHED";
        const historyBaselineInfo = savedBaselineEstablished
            ? null
            : computeBaselineFromHistory(history);
        const baselineInfo = savedBaselineEstablished
            ? {
                status: "SUFFICIENT",
                message: `Using the saved personal baseline calculated from ${patient.baseline.sampleCount} live MQTT readings.`,
                sampleCount: patient.baseline.sampleCount,
                requiredSamples: BASELINE_SAMPLE_COUNT,
                baseline: {
                    heartRate: patient.baseline.heartRate,
                    spo2: patient.baseline.spo2,
                    temperature: patient.baseline.temperature
                }
            }
            : historyBaselineInfo;
        const baseline = baselineInfo.baseline;

        const currentRisk = calculateBaselineSimulationRisk(
            currentState,
            baseline
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

        const simulatedRisk = calculateBaselineSimulationRisk(
            simulatedState,
            simulatedBaseline
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

        const patientsWithStatus = patients.map(presentPatient);

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

        const room = await Room.findOne({ roomId: patient.room });

        res.json(presentPatient(patient, room));

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
