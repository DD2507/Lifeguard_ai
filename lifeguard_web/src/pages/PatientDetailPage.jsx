import { formatVital, patientIndex, riskTone } from "../utils";

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
  prescriptionMessage,
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
  const tone = riskTone(patient.risk);

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

      <section className="bg-white rounded-3xl p-6 border border-slate-100">
        <h2 className="text-2xl font-display mb-4">Patient Digital Twin</h2>
        {digitalTwin ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-slate-50 rounded-2xl p-4">
                <h4 className="font-semibold text-sm mb-2">Current state</h4>
                <p>HR: {digitalTwin.currentState?.heartRate ?? "--"}</p>
                <p>SpO₂: {digitalTwin.currentState?.spo2 ?? "--"}%</p>
                <p>Temp: {digitalTwin.currentState?.temperature ?? "--"}°C</p>
              </div>
              <div className="bg-slate-50 rounded-2xl p-4">
                <h4 className="font-semibold text-sm mb-2">Personal baseline</h4>
                <p>HR: {digitalTwin.baseline?.heartRate ?? "--"}</p>
                <p>SpO₂: {digitalTwin.baseline?.spo2 ?? "--"}%</p>
                <p>Temp: {digitalTwin.baseline?.temperature ?? "--"}°C</p>
              </div>
              <div className="bg-slate-50 rounded-2xl p-4">
                <h4 className="font-semibold text-sm mb-2">Trend</h4>
                <p>HR: {digitalTwin.trends?.heartRate?.label ?? "N/A"}</p>
                <p>SpO₂: {digitalTwin.trends?.spo2?.label ?? "N/A"}</p>
                <p>Temp: {digitalTwin.trends?.temperature?.label ?? "N/A"}</p>
              </div>
            </div>
            <p className="text-xs text-slate-500 mt-4">{digitalTwin.dataQuality?.message}</p>
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
          Simulation only — this estimates how physiological indicators and the AI risk score could change. It does not provide a diagnosis.
        </p>
        {simulationResult && (
          <div className="mt-4 bg-slate-50 rounded-2xl p-4 text-sm">
            <p>Scenario: {simulationResult.scenario?.name || "Manual"}</p>
            <p>
              Simulated SpO₂: {simulationResult.simulatedState?.spo2 ?? "--"}% | Risk:{" "}
              {simulationResult.simulatedRisk?.risk ?? "--"}
            </p>
            <p>{simulationResult.simulatedRisk?.riskSummary}</p>
          </div>
        )}
      </section>

      <section className={`rounded-3xl p-6 border ${tone.card} ${tone.soft}`}>
        <p className="text-xs uppercase tracking-wider font-semibold">Current Risk Assessment</p>
        <h2 className="text-3xl font-display mt-1">{patient.risk} RISK</h2>
        <p className="text-sm">Risk Score: {patient.riskScore}</p>
        <p className="mt-3 text-sm">{patient.riskSummary || "No risk explanation available."}</p>
      </section>

      <section className="bg-white rounded-3xl p-6 border border-slate-100">
        <h2 className="text-2xl font-display mb-4">Explainable AI</h2>
        {(patient.riskReasons || []).length === 0 ? (
          <p className="text-sm text-slate-500">No contributing risk factors detected.</p>
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
        {prescriptionMessage && (
          <div className="mt-3 text-sm rounded-xl px-3 py-2 bg-slate-50 border">{prescriptionMessage}</div>
        )}
        {showPrescriptionForm && (
          <form className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3" onSubmit={onSavePrescription}>
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
            <input className="rounded-xl border px-3 py-2 text-sm" name="scheduledTime" placeholder="Scheduled time" value={prescriptionForm.scheduledTime} onChange={onPrescriptionChange} />
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
            <input className="rounded-xl border px-3 py-2 text-sm md:col-span-2" type="date" name="startDate" value={prescriptionForm.startDate} onChange={onPrescriptionChange} />
            <textarea className="rounded-xl border px-3 py-2 text-sm md:col-span-2" name="instructions" rows="2" placeholder="Instructions" value={prescriptionForm.instructions} onChange={onPrescriptionChange} />
            <div className="md:col-span-2 flex gap-2">
              <button type="submit" className="bg-slate-900 text-white rounded-full px-5 py-2 text-sm">
                {editingPrescriptionId ? "Update" : "Save & Prescribe"}
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
