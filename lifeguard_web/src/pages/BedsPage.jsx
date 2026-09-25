import { useMemo, useState } from "react";
import { occupancyRate, formatVital, riskTone } from "../utils";

export default function BedsPage({
  beds,
  patients,
  message,
  assignmentBed,
  assignmentPatientId,
  setAssignmentBed,
  setAssignmentPatientId,
  assignBed,
  releaseBed,
  setBedMaintenance,
  setBedAvailable,
  deleteBed,
  onOpenPatient
}) {
  const [filter, setFilter] = useState("ALL");
  const available = beds.filter((b) => b.status === "AVAILABLE").length;
  const occupied = beds.filter((b) => b.status === "OCCUPIED").length;
  const maintenance = beds.filter((b) => b.status === "MAINTENANCE").length;

  const visible = useMemo(() => {
    if (filter === "ALL") return beds;
    return beds.filter((bed) => bed.status === filter);
  }, [beds, filter]);

  const patientById = Object.fromEntries(patients.map((p) => [p.patientId, p]));

  return (
    <>
      <section className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl lg:text-5xl font-display text-slate-900">Bed Availability</h1>
          <p className="text-slate-600 mt-1">Monitor bed occupancy and assign patients to available beds.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-white/80 px-4 py-2 rounded-full border border-slate-200 shadow-sm">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
            <span className="text-xs font-semibold text-slate-700 uppercase">Occupancy Rate:</span>
            <span className="text-sm font-bold">{occupancyRate(beds)}%</span>
          </div>
          <div className="bg-slate-950 text-emerald-400 font-semibold text-sm px-4 py-2 rounded-full">
            {beds.length} Total Beds
          </div>
        </div>
      </section>

      {message && (
        <div className="bg-white border border-emerald-200 text-emerald-800 rounded-2xl px-4 py-3 text-sm">{message}</div>
      )}

      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {[
          ["Capacity", beds.length, "Total Beds", "🏥", "text-slate-900"],
          ["Ready for Intake", available, "Available", "✅", "text-emerald-600"],
          ["In Active Care", occupied, "Occupied", "🛏️", "text-slate-900"],
          ["Sanitization", maintenance, "Maintenance", "🛠️", "text-slate-900"]
        ].map(([label, value, sub, icon, color]) => (
          <div key={label} className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</span>
              <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-xl">{icon}</div>
            </div>
            <div className={`mt-4 text-5xl font-display ${color}`}>{value}</div>
            <div className="text-slate-700 font-medium text-sm mt-0.5">{sub}</div>
          </div>
        ))}
      </section>

      {assignmentBed && (
        <section className="bg-white rounded-2xl p-6 border border-slate-200">
          <h3 className="font-display text-2xl">Assign Patient to {assignmentBed.bedId}</h3>
          <select
            className="mt-3 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
            value={assignmentPatientId}
            onChange={(event) => setAssignmentPatientId(event.target.value)}
          >
            <option value="">Select a patient</option>
            {patients.map((patient) => (
              <option key={patient.patientId} value={patient.patientId}>
                {patient.patientId} - {patient.name}
              </option>
            ))}
          </select>
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              className="bg-slate-900 text-white rounded-full px-5 py-2 text-sm"
              onClick={() => assignmentPatientId && assignBed(assignmentBed.bedId, assignmentPatientId)}
            >
              Assign Bed
            </button>
            <button
              type="button"
              className="border rounded-full px-5 py-2 text-sm"
              onClick={() => {
                setAssignmentBed(null);
                setAssignmentPatientId("");
              }}
            >
              Cancel
            </button>
          </div>
        </section>
      )}

      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white/70 p-4 rounded-2xl border">
          <h2 className="text-2xl font-display">ICU Ward — Real-time Bed Status</h2>
          <div className="flex gap-1.5 flex-wrap">
            {[
              ["ALL", `All Beds (${beds.length})`],
              ["OCCUPIED", `Occupied (${occupied})`],
              ["AVAILABLE", `Available (${available})`],
              ["MAINTENANCE", `Maintenance (${maintenance})`]
            ].map(([id, label]) => (
              <button
                key={id}
                type="button"
                className={`text-xs font-semibold px-3 py-1.5 rounded-full ${
                  filter === id ? "bg-slate-900 text-white" : "bg-white border text-slate-600"
                }`}
                onClick={() => setFilter(id)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {visible.map((bed) => {
            const assigned = bed.patientId ? patientById[bed.patientId] : null;
            const tone = riskTone(assigned?.risk || "LOW");
            const occupiedCard = bed.status === "OCCUPIED";
            return (
              <article
                key={bed.bedId}
                className={`bg-white rounded-2xl p-5 shadow-sm border-2 relative overflow-hidden ${
                  occupiedCard ? "border-rose-400/80" : "border-slate-100"
                }`}
              >
                {occupiedCard && <div className="absolute top-0 left-0 right-0 h-1.5 bg-rose-500" />}
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                      {bed.ward} • Room {bed.room}
                    </span>
                    <h3 className="text-3xl font-display text-slate-900">Bed {bed.bedId}</h3>
                    <p className="text-xs text-slate-500">Bay #{bed.bedNumber}</p>
                  </div>
                  <span
                    className={`text-[11px] font-bold px-2.5 py-1 rounded-full uppercase ${
                      bed.status === "AVAILABLE"
                        ? "bg-emerald-100 text-emerald-700"
                        : bed.status === "MAINTENANCE"
                        ? "bg-amber-100 text-amber-700"
                        : "bg-rose-100 text-rose-700"
                    }`}
                  >
                    {bed.status}
                  </span>
                </div>

                {occupiedCard && (
                  <div className="mt-4 p-3 bg-rose-50/60 rounded-xl border border-rose-100">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900 text-sm">{bed.patientName || "Assigned patient"}</span>
                      <span className="text-[10px] font-bold bg-white px-2 py-0.5 rounded border">{bed.patientId}</span>
                    </div>
                    <div className={`text-xs font-semibold mt-1 ${tone.text}`}>
                      Status: {assigned?.risk || "Unknown"} Risk
                    </div>
                    <div className="grid grid-cols-3 gap-2 mt-3 text-center">
                      <div className="bg-white p-2 rounded-lg border">
                        <div className="text-[10px] uppercase font-bold text-slate-400">HR</div>
                        <div className="text-sm font-bold">{formatVital(assigned?.heartRate)} BPM</div>
                      </div>
                      <div className="bg-white p-2 rounded-lg border">
                        <div className="text-[10px] uppercase font-bold text-slate-400">SpO2</div>
                        <div className="text-sm font-bold">{formatVital(assigned?.spo2, "%")}</div>
                      </div>
                      <div className="bg-white p-2 rounded-lg border">
                        <div className="text-[10px] uppercase font-bold text-slate-400">Temp</div>
                        <div className="text-sm font-bold">{formatVital(assigned?.temperature, "°C")}</div>
                      </div>
                    </div>
                  </div>
                )}

                <div className="mt-5 pt-3 border-t border-slate-100 flex flex-wrap gap-2">
                  {bed.status === "AVAILABLE" && (
                    <button
                      type="button"
                      className="flex-1 bg-slate-900 text-white font-medium text-xs py-2 rounded-xl"
                      onClick={() => {
                        setAssignmentBed(bed);
                        setAssignmentPatientId("");
                      }}
                    >
                      Assign Patient
                    </button>
                  )}
                  {occupiedCard && (
                    <>
                      <button
                        type="button"
                        className="flex-1 bg-rose-600 text-white font-medium text-xs py-2 rounded-xl"
                        onClick={() => onOpenPatient(bed.patientId)}
                      >
                        View Telemetry
                      </button>
                      <button
                        type="button"
                        className="px-3 bg-slate-100 text-slate-700 font-medium text-xs py-2 rounded-xl"
                        onClick={() => releaseBed(bed.bedId)}
                      >
                        Release
                      </button>
                    </>
                  )}
                  {bed.status === "MAINTENANCE" && (
                    <button
                      type="button"
                      className="flex-1 bg-emerald-600 text-white font-medium text-xs py-2 rounded-xl"
                      onClick={() => setBedAvailable(bed.bedId)}
                    >
                      Set Available
                    </button>
                  )}
                  {bed.status !== "MAINTENANCE" && (
                    <button
                      type="button"
                      className="px-3 bg-amber-50 text-amber-800 font-medium text-xs py-2 rounded-xl"
                      onClick={() => setBedMaintenance(bed.bedId)}
                    >
                      Maintenance
                    </button>
                  )}
                  <button
                    type="button"
                    className="px-3 bg-slate-50 text-rose-700 font-medium text-xs py-2 rounded-xl"
                    onClick={() => deleteBed(bed.bedId)}
                  >
                    Delete
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
        <h2 className="text-2xl font-display">Recent Bed Occupancy</h2>
        <p className="text-xs text-slate-500 mt-0.5">Live census from the beds API.</p>
        <div className="overflow-x-auto mt-4">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-[11px] font-bold text-slate-400 uppercase tracking-wider border-b">
                <th className="pb-3">Bed & Location</th>
                <th className="pb-3">Patient</th>
                <th className="pb-3">Ward</th>
                <th className="pb-3 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {beds.map((bed) => (
                <tr key={`log-${bed.bedId}`}>
                  <td className="py-3 font-semibold">
                    Bed {bed.bedId} <span className="text-xs text-slate-400 font-normal">Room {bed.room}</span>
                  </td>
                  <td className="py-3">{bed.patientName || "—"}</td>
                  <td className="py-3 text-slate-600">{bed.ward}</td>
                  <td className="py-3 text-right text-xs font-semibold">{bed.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
