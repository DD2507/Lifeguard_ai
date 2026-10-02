import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../api";
import { formatVital, patientIndex, riskTone } from "../utils";

const BPM_BASELINE_MIN_READINGS = 15;
const BPM_BASELINE_MAX_READINGS = 15;

const VITAL_RANGES = {
  heartRate: [30, 220],
  spo2: [70, 100],
  temperature: [25, 45]
};

function validVital(value, metric, sensorStatus) {
  if (sensorStatus !== "LIVE" || value === null || value === undefined || String(value).trim() === "") return null;
  const number = Number(value);
  const [minimum, maximum] = VITAL_RANGES[metric];
  return Number.isFinite(number) && number >= minimum && number <= maximum ? number : null;
}

export default function PatientDetailPage({
  patient,
  digitalTwin,
  simulationResult,
  scenario,
  setScenario,
  manualInputs,
  onManualInput,
  onSimulate,
  onBack,
  prescriptions,
  prescriptionsLoading,
  savingPrescription,
  showPrescriptionForm,
  setShowPrescriptionForm,
  prescriptionForm,
  onPrescriptionChange,
  onSavePrescription,
  resetPrescriptionForm,
  editingPrescriptionId,
  onEditPrescription,
  onStatus,
  onDelete
}) {
  const [collectingBpmBaseline, setCollectingBpmBaseline] = useState(false);
  const [savingBpmBaseline, setSavingBpmBaseline] = useState(false);
  const [bpmBaselineSamples, setBpmBaselineSamples] = useState([]);
  const [bpmBaselineAverage, setBpmBaselineAverage] = useState(null);
  const [bpmBaselineMessage, setBpmBaselineMessage] = useState("");
  const [sessionBaseline, setSessionBaseline] = useState(null);
  const bpmBaselineSamplesRef = useRef([]);
  const bpmBaselineSeenRef = useRef(new Set());
  const bpmBaselineSaveInFlightRef = useRef(false);
  const bpmBaselinePatientKeyRef = useRef(`${patient.patientId}:${patient.room}`);

  useEffect(() => {
    const patientKey = `${patient.patientId}:${patient.room}`;
    if (bpmBaselinePatientKeyRef.current === patientKey) return;
    bpmBaselinePatientKeyRef.current = patientKey;
    bpmBaselineSamplesRef.current = [];
    bpmBaselineSeenRef.current = new Set();
    setCollectingBpmBaseline(false);
    setBpmBaselineSamples([]);
    setBpmBaselineAverage(null);
    setBpmBaselineMessage("");
    setSessionBaseline(null);
  }, [patient.patientId, patient.room]);

  const persistBpmBaseline = useCallback(async (samples) => {
    if (bpmBaselineSaveInFlightRef.current) return;
    bpmBaselineSaveInFlightRef.current = true;
    setCollectingBpmBaseline(false);
    setSavingBpmBaseline(true);
    try {
      const result = await api.savePatientBaseline(patient.patientId, samples);
      const savedBaseline = result.baseline;
      setBpmBaselineAverage(Number(savedBaseline.heartRate));
      setSessionBaseline({
        patientId: patient.patientId,
        baseline: {
          heartRate: savedBaseline.heartRate,
          spo2: savedBaseline.spo2,
          temperature: savedBaseline.temperature
        },
        sampleCount: savedBaseline.sampleCount
      });
      setBpmBaselineMessage(`Baseline saved for this patient using ${savedBaseline.sampleCount} valid MQTT readings.`);
    } catch (error) {
      setBpmBaselineAverage(null);
      setSessionBaseline(null);
      setBpmBaselineMessage(error.message || "Failed to save the calculated patient baseline.");
    } finally {
      bpmBaselineSaveInFlightRef.current = false;
      setSavingBpmBaseline(false);
    }
  }, [patient.patientId]);

  useEffect(() => {
    if (!collectingBpmBaseline) return;
    const rawTimestamp = patient.lastValidReadingAt;
    const timestamp = rawTimestamp ? new Date(rawTimestamp).getTime() : NaN;
    const heartRate = validVital(patient.heartRate, "heartRate", patient.sensorStatus);
    const spo2 = validVital(patient.spo2, "spo2", patient.sensorStatus);
    const temperature = validVital(patient.temperature, "temperature", patient.sensorStatus);
    if (!Number.isFinite(timestamp) || heartRate === null || spo2 === null || temperature === null) return;
    const timestampKey = String(timestamp);
    if (bpmBaselineSeenRef.current.has(timestampKey)) return;
    bpmBaselineSeenRef.current.add(timestampKey);

    const samples = [...bpmBaselineSamplesRef.current, {
      sensorStatus: "LIVE",
      heartRate,
      spo2,
      temperature,
      fingerDetected: patient.fingerDetected,
      heartRateStatus: patient.heartRateStatus,
      spo2Status: patient.spo2Status,
      receivedAt: new Date(timestamp).toISOString()
    }].slice(-BPM_BASELINE_MAX_READINGS);
    bpmBaselineSamplesRef.current = samples;
    setBpmBaselineSamples(samples);

    if (samples.length === BPM_BASELINE_MAX_READINGS) {
      void persistBpmBaseline(samples);
    }
  }, [collectingBpmBaseline, patient.lastValidReadingAt, patient.heartRate, patient.spo2, patient.temperature, patient.sensorStatus, persistBpmBaseline]);

  const startBpmBaselineCollection = () => {
    bpmBaselineSamplesRef.current = [];
    bpmBaselineSeenRef.current = new Set();
    setBpmBaselineSamples([]);
    setBpmBaselineAverage(null);
    setSessionBaseline(null);
    setBpmBaselineMessage("");
    setCollectingBpmBaseline(true);
  };

  const digitalTwinForPatient = digitalTwin?.patient?.patientId === patient.patientId ? digitalTwin : null;
  const savedSessionBaseline = sessionBaseline?.patientId === patient.patientId ? sessionBaseline : null;
  const backendBaseline = digitalTwinForPatient?.baseline;
  const backendBaselineEstablished = digitalTwinForPatient?.dataQuality?.status === "ESTABLISHED" &&
    validVital(backendBaseline?.heartRate, "heartRate", "LIVE") !== null &&
    validVital(backendBaseline?.spo2, "spo2", "LIVE") !== null &&
    validVital(backendBaseline?.temperature, "temperature", "LIVE") !== null;
  // Preserve the newly saved client result while an older polling response is
  // still in flight. Switch to the shared backend value once it is complete.
  const personalBaseline = backendBaselineEstablished
    ? backendBaseline
    : savedSessionBaseline?.baseline || null;
  const currentState = digitalTwinForPatient?.currentState;
  const currentSensorStatus = digitalTwinForPatient?.dataQuality?.sensorStatus;

  const currentVital = (metric) => validVital(currentState?.[metric], metric, currentSensorStatus);
  const baselineVital = (metric) => validVital(personalBaseline?.[metric], metric, "LIVE");
  const baselineMetricCount = backendBaselineEstablished
    ? digitalTwinForPatient.dataQuality.sampleCount
    : savedSessionBaseline?.sampleCount ?? 0;
  const displayedBpmAverage = backendBaselineEstablished && digitalTwinForPatient?.dataQuality?.baselineMethod === "mean"
    ? baselineVital("heartRate")
    : bpmBaselineAverage;
  const displayedBpmCount = (collectingBpmBaseline || savingBpmBaseline)
    ? bpmBaselineSamples.length
    : backendBaselineEstablished
      ? digitalTwinForPatient.dataQuality.sampleCount
      : savedSessionBaseline?.sampleCount ?? bpmBaselineSamples.length;
  const formatTwinCurrent = (metric, decimals, unit = "") => {
    const value = currentVital(metric);
    return value === null ? "Unavailable" : `${value.toFixed(decimals)}${unit}`;
  };
  const formatTwinBaseline = (metric, decimals, unit = "") => {
    const value = baselineVital(metric);
    return value === null ? "Insufficient data" : `${value.toFixed(decimals)}${unit}`;
  };
  const displayDeviation = (metric) => {
    const current = currentVital(metric);
    const baseline = baselineVital(metric);
    return current === null || baseline === null ? "Insufficient data" : (current - baseline).toFixed(2);
  };

  const handDetected = patient.fingerDetected === true;
  const riskAvailable = handDetected && patient.baselineStatus === "ESTABLISHED" && patient.risk != null;
  const riskUnavailableMessage = !handDetected
    ? "Hand not detected. Place a finger on the pulse-oximeter sensor to show the risk."
    : patient.baselineStatus !== "ESTABLISHED"
      ? "Calculate the 15-reading patient baseline to show the risk."
      : "Risk assessment is waiting for a valid live sensor reading.";
  const tone = riskTone(riskAvailable ? patient.risk : null, patient.baselineStatus, patient.sensorStatus);
  const riskLabel = patient.fingerDetected !== true
    ? "HAND NOT DETECTED"
    : patient.baselineStatus !== "ESTABLISHED"
      ? "CALCULATE BASELINE"
      : patient.risk
    ? `${patient.risk} RISK`
      : patient.sensorStatus || "RISK UNAVAILABLE";

  return (
    <div className="space-y-6">
      <button
        type="button"
        className="text-sm font-semibold text-slate-600 hover:text-slate-900"
        onClick={onBack}
      >
        ← Back to Dashboard
      </button>

      <section className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className={`w-16 h-16 rounded-2xl ${tone.soft} ${tone.text} flex items-center justify-center font-display text-2xl`}>
            {patientIndex(patient.patientId)}
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Patient Details</p>
            <h1 className="text-4xl font-display text-slate-900">{patient.name}</h1>
            <p className="text-sm text-slate-500">
              {patient.patientId} • Room {patient.room}
            </p>
          </div>
        </div>
        <span className={`px-4 py-2 rounded-full text-sm font-bold border ${tone.pill}`}>{tone.label}</span>
      </section>

      <section>
        <h2 className="text-2xl font-display mb-3">Live Vitals</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            ["Heart Rate", formatVital(patient.heartRate, " BPM")],
            ["SpO₂", formatVital(patient.spo2, "%")],
            ["Body Temperature", formatVital(patient.temperature, "°C")]
          ].map(([label, value]) => (
            <div key={label} className="bg-white rounded-2xl p-5 border border-slate-100">
              <p className="text-xs uppercase tracking-wider text-slate-400 font-semibold">{label}</p>
              <p className="text-3xl font-metric font-bold mt-2">{value}</p>
            </div>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-slate-600">
          <span>Sensor: {patient.sensorStatus || "SENSOR_DISCONNECTED"}</span>
          <span>Last valid reading: {patient.lastValidReadingAt ? new Date(patient.lastValidReadingAt).toLocaleString() : "Never"}</span>
          <span>Baseline: {patient.baselineStatus || "BASELINE_CALIBRATING"} ({patient.baseline?.sampleCount ?? 0}/{patient.baselineRequiredSamples ?? 15})</span>
        </div>
        {patient.lastSensorError && <p className="mt-1 text-xs text-amber-700">{patient.lastSensorError}</p>}
      </section>

      <section>
        <h2 className="text-2xl font-display mb-3">Room Environment</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            ["Room Temperature", `${patient.roomContext?.temperature ?? "--"}°C`],
            ["Humidity", `${patient.roomContext?.humidity ?? "--"}%`],
            ["Air Quality", patient.roomContext?.airQuality ?? "--"]
          ].map(([label, value]) => (
            <div key={label} className="bg-white rounded-2xl p-5 border border-slate-100">
              <p className="text-xs uppercase tracking-wider text-slate-400 font-semibold">{label}</p>
              <p className="text-3xl font-metric font-bold mt-2">{value}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5" aria-label="BPM Baseline">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-display text-slate-900">BPM Baseline</h2>
            <p className="mt-1 text-xs text-slate-500">Averages from the same 15 distinct live ESP32/MQTT readings containing HR, SpO₂, and temperature.</p>
          </div>
          <button
            type="button"
            onClick={startBpmBaselineCollection}
            disabled={collectingBpmBaseline || savingBpmBaseline}
            className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:cursor-wait disabled:opacity-60"
          >
            {savingBpmBaseline ? "Saving baseline..." : collectingBpmBaseline ? `Collecting readings... ${bpmBaselineSamples.length}/${BPM_BASELINE_MAX_READINGS}` : "Calculate Baseline"}
          </button>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl bg-slate-50 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Current Heart Rate (BPM)</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{validVital(patient.heartRate, "heartRate", patient.sensorStatus) === null ? "Unavailable" : validVital(patient.heartRate, "heartRate", patient.sensorStatus).toFixed(0)}</p>
          </div>
          <div className="rounded-xl bg-slate-50 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Session Average Heart Rate (BPM)</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{displayedBpmAverage === null ? "—" : displayedBpmAverage.toFixed(2)}</p>
          </div>
          <div className="rounded-xl bg-slate-50 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Collected Live IoT Readings</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{displayedBpmCount}/{BPM_BASELINE_MAX_READINGS}</p>
          </div>
        </div>
        {bpmBaselineMessage && (
          <p className={`mt-3 text-sm ${bpmBaselineAverage === null ? "text-amber-800" : "text-emerald-800"}`} role={bpmBaselineAverage === null ? "alert" : "status"}>
            {bpmBaselineMessage}
          </p>
        )}
        {(collectingBpmBaseline || savingBpmBaseline) && (
          <p className="mt-3 text-sm text-slate-600" role="status">Waiting until all {BPM_BASELINE_MIN_READINGS} distinct live IoT readings are received. Collection will not stop early.</p>
        )}
      </section>

      <section className="bg-white rounded-3xl p-6 border border-slate-100">
        <h2 className="text-2xl font-display mb-4">Patient Digital Twin</h2>
        {digitalTwinForPatient ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-slate-50 rounded-2xl p-4">
                <h4 className="font-semibold text-sm mb-2">Current state</h4>
                <p>HR: {formatTwinCurrent("heartRate", 0, " BPM")}</p>
                <p>SpO₂: {formatTwinCurrent("spo2", 2, "%")}</p>
                <p>Temp: {formatTwinCurrent("temperature", 2, "°C")}</p>
              </div>
              <div className="bg-slate-50 rounded-2xl p-4">
                <h4 className="font-semibold text-sm mb-2">Personal baseline</h4>
                <p>HR: {formatTwinBaseline("heartRate", 2, " BPM")} <span className="text-xs text-slate-500">({baselineMetricCount} readings)</span></p>
                <p>SpO₂: {formatTwinBaseline("spo2", 2, "%")} <span className="text-xs text-slate-500">({baselineMetricCount} readings)</span></p>
                <p>Temp: {formatTwinBaseline("temperature", 2, "°C")} <span className="text-xs text-slate-500">({baselineMetricCount} readings)</span></p>
                <p className="mt-2 text-xs text-slate-600">Deviation: HR {displayDeviation("heartRate")} BPM, SpO₂ {displayDeviation("spo2")}%, Temp {displayDeviation("temperature")}°C</p>
              </div>
              <div className="bg-slate-50 rounded-2xl p-4">
                <h4 className="font-semibold text-sm mb-2">Trend</h4>
                <p>HR: {digitalTwinForPatient.trends?.heartRate?.label ?? "INSUFFICIENT_DATA"}</p>
                <p>SpO₂: {digitalTwinForPatient.trends?.spo2?.label ?? "INSUFFICIENT_DATA"}</p>
                <p>Temp: {digitalTwinForPatient.trends?.temperature?.label ?? "INSUFFICIENT_DATA"}</p>
              </div>
            </div>
            <p className="text-xs text-slate-500 mt-4">{savedSessionBaseline ? `Session baseline saved for ${patient.patientId} from ${savedSessionBaseline.sampleCount} valid MQTT readings.` : digitalTwinForPatient.dataQuality?.message}</p>
          </>
        ) : (
          <p className="text-sm text-slate-500">Loading digital twin…</p>
        )}
      </section>

      <section className="bg-white rounded-3xl p-6 border border-slate-100">
        <h2 className="text-2xl font-display mb-4">What-If Simulator</h2>
        <label className="text-xs font-semibold uppercase text-slate-500">Scenario</label>
        <select
          className="mt-2 mb-4 block w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
          value={scenario}
          onChange={(event) => setScenario(event.target.value)}
        >
          <option value="REDUCED_OXYGEN">Reduced Oxygen</option>
          <option value="FEVER_LIKE">Fever-Like</option>
          <option value="ELEVATED_HEART_RATE">Elevated Heart Rate</option>
          <option value="COMBINED_DETERIORATION">Combined Deterioration</option>
          <option value="POOR_ROOM_ENVIRONMENT">Poor Room Environment</option>
        </select>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {Object.keys(manualInputs).map((key) => (
            <input
              key={key}
              type="number"
              name={key}
              placeholder={key}
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
              value={manualInputs[key]}
              onChange={onManualInput}
            />
          ))}
        </div>
        <button
          type="button"
          className="mt-4 bg-slate-900 text-white rounded-full px-5 py-2 text-sm font-semibold"
          onClick={onSimulate}
        >
          Simulate Scenario
        </button>
        <p className="text-xs text-slate-500 mt-3">
          Simulation only — this compares virtual physiological readings with the saved personal baseline. It does not provide a diagnosis.
        </p>
        {simulationResult && (
          <div className="mt-4 rounded-2xl border border-emerald-600 bg-emerald-50 p-4 text-sm text-slate-900">
            <h3 className="text-lg font-bold">
              Simulated Scenario: {simulationResult.scenario?.name || "Manual"}
            </h3>
            <p className="mt-2">
              Simulated SpO₂: {simulationResult.simulatedState?.spo2 ?? "--"}% | Deviation:{" "}
              {simulationResult.deviations?.spo2 ?? "--"}
            </p>
            <p className="mt-1">
              Simulated Risk: {simulationResult.simulatedRisk?.risk ?? "--"} | Score:{" "}
              {simulationResult.simulatedRisk?.riskScore ?? "--"}
            </p>
            <p className="mt-3 leading-6">
              {simulationResult.simulatedRisk?.riskSummary || "No risk summary available."}
            </p>

            <h4 className="mt-5 text-base font-bold">Why did the risk change?</h4>
            {(simulationResult.simulatedRisk?.riskReasons || []).length > 0 ? (
              <div className="mt-3 space-y-3">
                {simulationResult.simulatedRisk.riskReasons.map((reason, index) => (
                  <div
                    key={`${reason.factor || "factor"}-${index}`}
                    className="rounded-xl bg-white p-4 shadow-sm"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <strong>{reason.factor || "Contributing factor"}</strong>
                      {reason.severity && (
                        <span className="text-xs font-bold uppercase text-amber-700">
                          {reason.severity}
                        </span>
                      )}
                    </div>
                    {reason.value !== undefined && reason.value !== null && (
                      <p className="mt-1 font-semibold text-emerald-700">Value: {reason.value}</p>
                    )}
                    <p className="mt-1 leading-6 text-slate-700">
                      {reason.explanation || "No explanation available."}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-slate-600">No contributing risk factors were identified for this simulation.</p>
            )}
          </div>
        )}
      </section>

      <section className={`rounded-3xl p-6 border ${tone.card} ${tone.soft}`}>
        <p className="text-xs uppercase tracking-wider font-semibold">Current Risk Assessment</p>
        <h2 className="text-3xl font-display mt-1">{riskLabel}</h2>
        <p className="text-sm">
          Rule score: {riskAvailable ? patient.riskScore ?? "--" : "--"}
          {riskAvailable && patient.aiRisk ? ` · AI: ${patient.aiRisk}${patient.aiConfidence != null ? ` (${patient.aiConfidence})` : ""}` : ""}
          {riskAvailable && patient.aiRisk && patient.aiInferenceAt ? ` · Inferred ${new Date(patient.aiInferenceAt).toLocaleString()}` : ""}
        </p>
        <p className="mt-3 text-sm">{riskAvailable ? patient.riskSummary || "No current risk assessment available." : riskUnavailableMessage}</p>
        {riskAvailable && (patient.riskReasons || []).length > 0 && (
          <ul className="mt-3 list-disc pl-5 text-sm">
            {patient.riskReasons.map((reason, index) => (
              <li key={`${reason.factor}-${index}`}>{reason.factor}: {reason.explanation}</li>
            ))}
          </ul>
        )}
      </section>

      <section className="bg-white rounded-3xl p-6 border border-slate-100">
        <h2 className="text-2xl font-display mb-4">
          {patient.aiRisk ? "Explainable AI" : "Explainable Screening Rules"}
        </h2>
        {!riskAvailable || (patient.riskReasons || []).length === 0 ? (
          <p className="text-sm text-slate-500">{riskAvailable ? "No contributing risk factors detected." : riskUnavailableMessage}</p>
        ) : (
          <div className="space-y-3">
            {patient.riskReasons.map((reason, index) => (
              <div key={`${reason.factor}-${index}`} className="rounded-2xl border border-slate-100 p-4">
                <div className="flex justify-between">
                  <strong>{reason.factor}</strong>
                  <span className="text-xs font-bold">{reason.severity}</span>
                </div>
                <p className="text-sm text-slate-500">Value: {reason.value}</p>
                <p className="text-sm mt-1">{reason.explanation}</p>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="bg-white rounded-3xl p-6 border border-slate-100">
        <h2 className="text-2xl font-display mb-2">Recommended Room Action</h2>
        <p className="font-metric text-lg">
          Fan: {patient.recommendedAction?.fan ? "ON" : "OFF"} | Buzzer:{" "}
          {patient.recommendedAction?.buzzer ? "ON" : "OFF"}
        </p>
        <p className="text-sm text-slate-600 mt-2">
          {patient.recommendedAction?.reason || "No immediate room intervention is required."}
        </p>
      </section>

      <section className="bg-white rounded-3xl p-6 border border-slate-100">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-display">Doctor Prescriptions</h2>
            <p className="text-sm text-slate-500">Manage medications, IV fluids, and scheduled reminders.</p>
          </div>
          <button
            type="button"
            className="bg-[#d1f34d] text-slate-900 rounded-full px-4 py-2 text-xs font-bold"
            onClick={() => {
              resetPrescriptionForm();
              setShowPrescriptionForm(true);
            }}
          >
            + Add Treatment
          </button>
        </div>
        {showPrescriptionForm && (
          <form className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3" onSubmit={onSavePrescription}>
            <p className="text-xs text-slate-500 md:col-span-2">
              This reminder covers the entered date and time only. Repeating doses need explicit additional dose times.
            </p>
            <input className="rounded-xl border px-3 py-2 text-sm" name="treatmentName" placeholder="Treatment name" value={prescriptionForm.treatmentName} onChange={onPrescriptionChange} />
            <select className="rounded-xl border px-3 py-2 text-sm" name="type" value={prescriptionForm.type} onChange={onPrescriptionChange}>
              <option>Medication</option>
              <option>IV Fluid</option>
              <option>Injection</option>
              <option>Therapy</option>
              <option>Vital Check</option>
              <option>Other</option>
            </select>
            <input className="rounded-xl border px-3 py-2 text-sm" name="dosage" placeholder="Dosage" value={prescriptionForm.dosage} onChange={onPrescriptionChange} />
            <label className="text-xs font-semibold text-slate-600">
              Scheduled time (Asia/Kolkata)
              <input className="mt-1 block w-full rounded-xl border px-3 py-2 text-sm" name="scheduledTime" placeholder="22:00 or 10:00 PM" value={prescriptionForm.scheduledTime} onChange={onPrescriptionChange} />
            </label>
            <select className="rounded-xl border px-3 py-2 text-sm" name="frequency" value={prescriptionForm.frequency} onChange={onPrescriptionChange}>
              <option>Once only</option>
              <option>Once daily</option>
              <option>Twice daily</option>
              <option>Three times daily</option>
              <option>Every 8 hours</option>
              <option>Every 12 hours</option>
              <option>As needed</option>
            </select>
            <input className="rounded-xl border px-3 py-2 text-sm" name="duration" placeholder="Duration" value={prescriptionForm.duration} onChange={onPrescriptionChange} />
            <label className="text-xs font-semibold text-slate-600 md:col-span-2">
              Scheduled date
              <input className="mt-1 block w-full rounded-xl border px-3 py-2 text-sm" type="date" name="startDate" value={prescriptionForm.startDate} onChange={onPrescriptionChange} />
            </label>
            <textarea className="rounded-xl border px-3 py-2 text-sm md:col-span-2" name="instructions" rows="2" placeholder="Instructions" value={prescriptionForm.instructions} onChange={onPrescriptionChange} />
            <div className="md:col-span-2 flex gap-2">
              <button
                type="submit"
                className="bg-slate-900 text-white rounded-full px-5 py-2 text-sm disabled:opacity-60 disabled:cursor-not-allowed"
                disabled={savingPrescription}
              >
                {savingPrescription
                  ? (editingPrescriptionId ? "Updating..." : "Saving...")
                  : (editingPrescriptionId ? "Update" : "Save & Prescribe")}
              </button>
              <button type="button" className="border rounded-full px-5 py-2 text-sm" onClick={resetPrescriptionForm}>
                Cancel
              </button>
            </div>
          </form>
        )}
        <div className="mt-4 space-y-3">
          {prescriptionsLoading && prescriptions.length === 0 && (
            <p className="text-sm text-slate-500">Loading prescriptions...</p>
          )}
          {!prescriptionsLoading && prescriptions.length === 0 && (
            <p className="text-sm text-slate-500">No prescriptions recorded for this patient.</p>
          )}
          {prescriptions.map((item) => (
            <div key={item._id} className="rounded-2xl border border-slate-100 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="font-bold">{item.treatmentName}</h3>
                  <p className="text-xs text-slate-500">
                    {item.dosage} • {item.scheduledTime} • {item.frequency}
                  </p>
                </div>
                <span className="text-[11px] font-bold uppercase px-2 py-1 rounded-full bg-slate-100">{item.status}</span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {item.status === "ACTIVE" ? (
                  <>
                    <button type="button" className="text-xs bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full" onClick={() => onStatus(item._id, "COMPLETED")}>Complete</button>
                    <button type="button" className="text-xs bg-slate-100 px-3 py-1 rounded-full" onClick={() => onEditPrescription(item)}>Edit</button>
                    <button type="button" className="text-xs bg-rose-50 text-rose-700 px-3 py-1 rounded-full" onClick={() => onStatus(item._id, "CANCELLED")}>Cancel</button>
                  </>
                ) : (
                  <>
                    <button type="button" className="text-xs bg-slate-100 px-3 py-1 rounded-full" onClick={() => onStatus(item._id, "ACTIVE")}>Reactivate</button>
                    <button type="button" className="text-xs bg-rose-50 text-rose-700 px-3 py-1 rounded-full" onClick={() => onDelete(item._id)}>Delete</button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
