import { useMemo, useState } from "react";
import AlertCard from "../components/AlertCard";

export default function AlertsPage({ alerts, history, onOpenPatient, onResolveAlert }) {
  const [filter, setFilter] = useState("ACTIVE");
  const high = alerts.filter((a) => a.risk === "HIGH").length;
  const moderate = alerts.filter((a) => a.risk === "MODERATE").length;
  const resolved = (history || []).filter((a) => a.status === "RESOLVED");

  const list = useMemo(() => {
    if (filter === "HIGH") return alerts.filter((a) => a.risk === "HIGH");
    if (filter === "MODERATE") return alerts.filter((a) => a.risk === "MODERATE");
    if (filter === "RESOLVED") return resolved;
    return alerts;
  }, [alerts, filter, resolved]);

  return (
    <>
      <section className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-4xl lg:text-5xl font-display text-slate-900">Patient Alerts</h1>
            <span className="bg-rose-500 text-white text-xs font-bold px-3 py-1 rounded-full">
              {alerts.length} Active Alert{alerts.length === 1 ? "" : "s"}
            </span>
          </div>
          <p className="text-slate-600 text-base font-medium">
            Patients requiring immediate or closer clinical attention.
          </p>
        </div>
        <div className="flex items-center gap-2 bg-white/70 p-1.5 rounded-2xl border border-rose-200/60 text-xs font-semibold">
          {[
            ["ACTIVE", `All Alerts (${alerts.length})`],
            ["HIGH", `High Risk (${high})`],
            ["MODERATE", `Moderate (${moderate})`],
            ["RESOLVED", `Resolved (${resolved.length})`]
          ].map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={`px-3.5 py-1.5 rounded-xl ${filter === id ? "bg-white text-slate-900 shadow-xs border" : "text-slate-600"}`}
              onClick={() => setFilter(id)}
            >
              {label}
            </button>
          ))}
        </div>
      </section>

      <section className="space-y-5">
        {list.length === 0 ? (
          <div className="bg-white rounded-3xl p-8 text-slate-600">No alerts in this filter.</div>
        ) : (
          list.map((alert) => (
            <AlertCard
              key={alert._id}
              alert={alert}
              onOpen={onOpenPatient}
              onResolve={filter === "RESOLVED" ? undefined : onResolveAlert}
            />
          ))
        )}
      </section>
    </>
  );
}
