import { formatVital, patientIndex, riskTone } from "../utils";

export default function PatientCard({ patient, onOpen }) {
  const tone = riskTone(patient.risk, patient.baselineStatus, patient.sensorStatus);
  return (
    <article
      className={`bg-white rounded-[28px] border shadow-[0_8px_30px_rgb(0,0,0,0.04)] p-6 flex flex-col justify-between cursor-pointer hover:-translate-y-1 transition-all ${tone.card}`}
      onClick={() => onOpen(patient.patientId)}
    >
      <div>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3.5">
            <div className={`w-12 h-12 rounded-2xl ${tone.soft} ${tone.text} flex items-center justify-center font-display text-lg`}>
              {patientIndex(patient.patientId)}
            </div>
            <div>
              <h2 className="text-2xl font-display text-slate-900">{patient.name}</h2>
              <p className="text-xs font-semibold text-slate-500">Room {patient.room}</p>
            </div>
          </div>
          <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border ${tone.pill}`}>
            {tone.label}
          </span>
        </div>
        <div className="mt-6 grid grid-cols-3 gap-2.5 text-center">
          <div className="bg-slate-50 rounded-2xl p-3.5 border border-slate-100">
            <div className="font-metric text-base font-extrabold text-slate-900">
              {formatVital(patient.heartRate)}
            </div>
            <span className="text-[11px] font-semibold tracking-wider text-slate-400 uppercase">BPM</span>
          </div>
          <div className="bg-slate-50 rounded-2xl p-3.5 border border-slate-100">
            <div className="font-metric text-base font-extrabold text-slate-900">
              {formatVital(patient.spo2, "%")}
            </div>
            <span className="text-[11px] font-semibold tracking-wider text-slate-400 uppercase">SpO₂</span>
          </div>
          <div className="bg-slate-50 rounded-2xl p-3.5 border border-slate-100">
            <div className="font-metric text-base font-extrabold text-slate-900">
              {formatVital(patient.temperature, "°C")}
            </div>
            <span className="text-[11px] font-semibold tracking-wider text-slate-400 uppercase">Temp</span>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
          <span>{patient.baselineStatus || "BASELINE_CALIBRATING"}: {patient.baseline?.sampleCount ?? 0}/{patient.baselineRequiredSamples ?? 10}</span>
          <span>{patient.sensorStatus || "SENSOR_DISCONNECTED"}</span>
        </div>
        <div className="mt-2 text-xs text-slate-500">
          Risk score: {patient.riskScore ?? "--"} · Last valid: {patient.lastValidReadingAt ? new Date(patient.lastValidReadingAt).toLocaleString() : "never"}
        </div>
        <p className="mt-2 line-clamp-2 text-xs text-slate-600">
          {patient.riskReasons?.[0]?.explanation || patient.riskSummary || "No current risk assessment."}
        </p>
      </div>
      <div className="mt-6 pt-4 border-t border-slate-100 text-xs font-bold text-slate-700 flex items-center justify-between">
        <span>View Patient Details</span>
        <span>→</span>
      </div>
    </article>
  );
}
