import { useMemo, useState } from "react";
import PatientCard from "../components/PatientCard";

export default function PatientsPage({ patients, onOpenPatient }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("ALL");

  const counts = {
    ALL: patients.length,
    HIGH: patients.filter((p) => p.risk === "HIGH").length,
    MODERATE: patients.filter((p) => p.risk === "MODERATE").length,
    LOW: patients.filter((p) => p.risk === "LOW").length
  };

  const visible = useMemo(() => {
    return patients.filter((patient) => {
      const haystack = `${patient.name} ${patient.patientId} ${patient.room}`.toLowerCase();
      const matchesQuery = haystack.includes(query.toLowerCase());
      const matchesRisk = filter === "ALL" || patient.risk === filter;
      return matchesQuery && matchesRisk;
    });
  }, [patients, query, filter]);

  return (
    <>
      <section className="bg-white rounded-[28px] border border-slate-100 shadow-sm p-6 sm:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[#e6fbf4] border border-[#a8edd8] text-[#00a884] text-xs font-semibold">
            Shift Overview • Intensive Care Unit
          </div>
          <h1 className="text-4xl sm:text-5xl font-display text-slate-900">All Patients</h1>
          <p className="text-sm text-slate-500">
            Here is the latest telemetry and clinical overview of your registered patients.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="px-3.5 py-1.5 rounded-full bg-[#f1f4f9] text-slate-700 text-xs font-semibold border">
            <strong>{patients.length}</strong> Active Patients
          </div>
          <div className="px-3.5 py-1.5 rounded-full bg-[#ffedf1] text-[#e5395b] text-xs font-semibold border border-[#ffd5df]">
            <strong>{counts.HIGH}</strong> Critical Attention
          </div>
        </div>
      </section>

      <section className="bg-white rounded-[24px] border border-slate-100 p-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <input
          className="flex-1 max-w-md px-4 py-2 bg-slate-50 border border-slate-200 rounded-full text-xs"
          placeholder="Search by name, ID, or room..."
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <div className="flex items-center gap-2 overflow-x-auto">
          {[
            ["ALL", `All (${counts.ALL})`, "bg-[#0d141e] text-white"],
            ["HIGH", `High Risk (${counts.HIGH})`, "bg-[#ffedf1] text-[#e5395b]"],
            ["MODERATE", `Moderate (${counts.MODERATE})`, "bg-[#fef7e6] text-[#d97706]"],
            ["LOW", `Stable (${counts.LOW})`, "bg-[#e6fbf4] text-[#00a884]"]
          ].map(([id, label, cls]) => (
            <button
              key={id}
              type="button"
              className={`px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap ${
                filter === id ? cls : "bg-slate-100 text-slate-600"
              }`}
              onClick={() => setFilter(id)}
            >
              {label}
            </button>
          ))}
        </div>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {visible.map((patient) => (
          <PatientCard key={patient.patientId} patient={patient} onOpen={onOpenPatient} />
        ))}
      </section>
    </>
  );
}
