import { useState } from "react";
import { formatVital, reasonValue, riskTone, timeAgo } from "../utils";

export default function AlertCard({ alert, onOpen, onResolve, onCompleteMedicine }) {
  const [completing, setCompleting] = useState(false);
  const [completionError, setCompletionError] = useState("");

  if (alert.alertType === "MEDICINE_DUE") {
    return (
      <article className="bg-white rounded-3xl p-5 sm:p-6 border border-rose-300 shadow-sm">
        <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <h3 className="text-base font-bold text-slate-900">MEDICINE DUE</h3>
              <span className="px-2 py-0.5 rounded bg-rose-600 text-white text-[10px] font-black">ACTION REQUIRED</span>
            </div>
            <p className="text-sm font-semibold text-slate-800">
              {alert.patientName || alert.patientId} ({alert.patientId}) · Room {alert.room || "--"}
            </p>
            <p className="mt-2 text-sm text-slate-700">
              {alert.treatmentName || "Medicine"} · {alert.dosage || "Dosage unavailable"}
            </p>
            {alert.instructions && <p className="mt-1 text-xs text-slate-600">Instructions: {alert.instructions}</p>}
            <p className="mt-2 text-xs font-semibold text-rose-700">
              Due {alert.dueTime || alert.scheduledAt || "time unavailable"} ({alert.timeZone || "Asia/Kolkata"})
            </p>
            <p className="mt-1 text-xs text-slate-600">Status: {alert.medicineStatus || "MEDICINE DUE"}</p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <div className="flex items-center gap-2">
              {onCompleteMedicine && alert.medicineStatus !== "COMPLETED" && (
                <button
                  type="button"
                  disabled={completing}
                  className="bg-emerald-700 hover:bg-emerald-800 disabled:opacity-60 text-white px-4 py-2 rounded-full font-semibold whitespace-nowrap text-xs"
                  onClick={async () => {
                    setCompleting(true);
                    setCompletionError("");
                    try {
                      await onCompleteMedicine(alert._id);
                    } catch (error) {
                      setCompletionError(error.message || "Could not complete this medicine dose.");
                    } finally {
                      setCompleting(false);
                    }
                  }}
                >
                  {completing ? "Completing..." : "Completed"}
                </button>
              )}
              <button
                type="button"
                className="bg-slate-900 text-white px-4 py-2 rounded-full font-semibold whitespace-nowrap text-xs"
                onClick={() => onOpen(alert.patientId)}
              >
                Open Patient
              </button>
            </div>
            {completionError && <p role="alert" className="max-w-64 text-right text-xs text-rose-700">{completionError}</p>}
          </div>
        </div>
      </article>
    );
  }

  const tone = riskTone(alert.risk);
  const hr = reasonValue(alert.reasons, "Heart Rate");
  const spo2 = reasonValue(alert.reasons, "SpO₂") ?? reasonValue(alert.reasons, "SpO2");
  const temp = reasonValue(alert.reasons, "Temperature");

  return (
    <article className={`bg-white rounded-3xl p-5 sm:p-6 border shadow-sm ${alert.risk === "HIGH" ? "border-rose-200/80" : "border-amber-200"}`}>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
        <div className="flex items-center gap-3.5">
          <div className={`w-10 h-10 rounded-2xl ${tone.soft} ${tone.text} flex items-center justify-center font-bold text-lg`}>
            ⚠
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-slate-900">{alert.patientName}</h3>
              <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${tone.solid}`}>
                {alert.risk}
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium">
              Room {alert.room} • {timeAgo(alert.createdAt)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200 text-slate-800 text-xs font-semibold">
            ♥ {formatVital(hr)} BPM
          </span>
          <span className="px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200 text-slate-800 text-xs font-semibold">
            ≈ {formatVital(spo2, "%")} SpO2
          </span>
          <span className="px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200 text-slate-800 text-xs font-semibold">
            ♨ {formatVital(temp, "°C")}
          </span>
        </div>
      </div>
      <div className="mt-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-xs">
        <p className="text-slate-600 leading-relaxed">
          <span className="font-bold text-slate-800 uppercase tracking-wide">MODEL:</span>{" "}
          {alert.summary || "Immediate attention recommended."}
        </p>
        <div className="flex gap-2">
          {onResolve && alert.status === "ACTIVE" && (
            <button
              type="button"
              className="bg-rose-600 hover:bg-rose-700 text-white px-4 py-2 rounded-full font-semibold whitespace-nowrap text-xs"
              onClick={(event) => {
                event.stopPropagation();
                onResolve(alert._id);
              }}
            >
              Acknowledge Alert
            </button>
          )}
          <button
            type="button"
            className="bg-slate-900 text-white px-4 py-2 rounded-full font-semibold whitespace-nowrap text-xs"
            onClick={() => onOpen(alert.patientId)}
          >
            Open Patient
          </button>
        </div>
      </div>
    </article>
  );
}
