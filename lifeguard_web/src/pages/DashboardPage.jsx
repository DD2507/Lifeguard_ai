import AlertCard from "../components/AlertCard";
import PatientCard from "../components/PatientCard";
import { greeting } from "../utils";

export default function DashboardPage({
  patients,
  alerts,
  beds,
  onOpenPatient,
  onResolveAlert,
  onNavigate
}) {
  const high = patients.filter((p) => p.risk === "HIGH").length;
  const low = patients.filter((p) => p.risk === "LOW").length;
  const availableBeds = beds.filter((bed) => bed.status === "AVAILABLE").slice(0, 2);
  const firstBed = beds.find((bed) => bed.status === "OCCUPIED");

  return (
    <>
      <section className="bg-white rounded-3xl p-6 sm:p-8 border border-[#e8e2d8] shadow-sm flex items-center justify-between">
        <div className="space-y-1.5">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-50 border border-amber-200/60 text-amber-900 text-xs font-semibold uppercase tracking-wider">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-600" />
            Shift Overview • Intensive Care Unit
          </div>
          <h1 className="text-3xl sm:text-4xl font-display text-slate-900 pt-1">{greeting()}</h1>
          <p className="text-sm text-slate-500 font-medium">Here is the latest overview of your patients.</p>
        </div>
        <div className="hidden sm:flex w-16 h-16 rounded-2xl bg-rose-50 border border-rose-100 items-center justify-center text-rose-500">
          ♥
        </div>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="bg-white rounded-3xl p-6 border border-[#e8e2d8] shadow-sm">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Patients</span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-4xl font-extrabold text-slate-900 font-metric">{patients.length}</span>
            <span className="text-xs font-semibold text-slate-500">Active Admitted</span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            {firstBed ? `Bed ${firstBed.bedId} assigned` : "No occupied beds yet"}
          </p>
          <svg className="w-full h-9 mt-4" preserveAspectRatio="none" viewBox="0 0 100 24">
            <polyline fill="none" points="0,18 20,16 40,20 60,11 80,14 100,8" stroke="#3b82f6" strokeWidth="2.5" strokeLinecap="round" />
          </svg>
        </div>
        <div className="bg-white rounded-3xl p-6 border border-[#e8e2d8] shadow-sm">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Low Risk</span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-4xl font-extrabold text-slate-900 font-metric">{low}</span>
            <span className="text-xs font-semibold text-slate-500">Normal Baseline</span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            {patients.length ? `${Math.round((low / patients.length) * 100)}% of Census` : "0% of Census"}
          </p>
          <svg className="w-full h-9 mt-4" preserveAspectRatio="none" viewBox="0 0 100 24">
            <polyline fill="none" points="0,14 25,14 50,14 75,14 100,14" stroke="#10b981" strokeWidth="2.5" />
          </svg>
        </div>
        <div className="bg-white rounded-3xl p-6 border border-[#e8e2d8] shadow-sm">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">High Risk</span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-4xl font-extrabold text-rose-600 font-metric">{high}</span>
            <span className="text-xs font-semibold text-rose-600">AI Predicted</span>
          </div>
          <p className="text-xs text-rose-500 mt-0.5 font-medium">{high ? "Immediate triage" : "No critical flags"}</p>
          <svg className="w-full h-9 mt-4" preserveAspectRatio="none" viewBox="0 0 100 24">
            <polyline fill="none" points="0,20 25,18 45,12 70,15 85,6 100,4" stroke="#e11d48" strokeWidth="2.5" />
          </svg>
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-display text-slate-900">🚨 Active Alerts</h2>
          <span className="px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800 text-xs font-bold">
            {alerts.length} Active
          </span>
        </div>
        {alerts.length === 0 ? (
          <div className="bg-white rounded-3xl p-6 border border-emerald-100 text-emerald-700 font-medium">
            No active alerts currently detected
          </div>
        ) : (
          alerts.map((alert) => (
            <AlertCard
              key={alert._id}
              alert={alert}
              onOpen={onOpenPatient}
              onResolve={onResolveAlert}
            />
          ))
        )}
      </section>

      <section className="space-y-4 pt-2">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-display text-slate-900">Patient Monitoring</h2>
          <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500 bg-white px-3 py-1 rounded-full border border-[#e8e2d8]">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Live Data • Updates every 1.5 sec
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {patients.map((patient) => (
            <PatientCard key={patient.patientId} patient={patient} onOpen={onOpenPatient} />
          ))}
          {availableBeds.map((bed) => (
            <div
              key={bed.bedId}
              className="bg-white rounded-3xl p-5 border border-dashed border-slate-300 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold text-slate-400">{bed.bedId}</span>
                  <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-bold uppercase">
                    Available
                  </span>
                </div>
                <div className="w-10 h-10 rounded-2xl bg-slate-100 text-slate-500 flex items-center justify-center font-bold text-xl mb-3">
                  +
                </div>
                <h3 className="text-base font-bold text-slate-900">Room {bed.room} Available</h3>
                <p className="text-xs text-slate-500 mt-1">Telemetry ready for next patient intake</p>
              </div>
              <button
                type="button"
                className="mt-6 w-full py-2.5 rounded-full border border-slate-300 text-slate-800 text-xs font-semibold"
                onClick={() => onNavigate("beds")}
              >
                Assign Patient
              </button>
            </div>
          ))}
        </div>
        {!patients.length && (
          <p className="text-sm text-slate-500">No patients in the monitoring census yet.</p>
        )}
      </section>
    </>
  );
}
