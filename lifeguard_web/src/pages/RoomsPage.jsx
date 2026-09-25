export default function RoomsPage({ rooms, patients, onOpenPatient }) {
  return (
    <>
      <section className="flex items-end justify-between">
        <div>
          <h1 className="text-4xl font-display text-slate-900">Room Monitoring</h1>
          <p className="text-slate-600 mt-1">Environmental conditions and patients by room.</p>
        </div>
        <span className="bg-slate-900 text-emerald-400 font-semibold text-sm px-4 py-2 rounded-full">
          {rooms.length} Rooms
        </span>
      </section>
      <section className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {rooms.map((room) => {
          const roomPatients = patients.filter((patient) => patient.room === room.roomId);
          return (
            <article key={room.roomId} className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-3xl font-display text-slate-900">Room {room.roomId}</h2>
                  <p className="text-sm text-slate-500">{roomPatients.length} patient{roomPatients.length === 1 ? "" : "s"}</p>
                </div>
                <span className="text-2xl">🏥</span>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                <div className="bg-slate-50 rounded-xl p-3">Temp {room.temperature ?? "--"}°C</div>
                <div className="bg-slate-50 rounded-xl p-3">Humidity {room.humidity ?? "--"}%</div>
                <div className="bg-slate-50 rounded-xl p-3">AQ {room.airQuality ?? "--"}</div>
                <div className="bg-slate-50 rounded-xl p-3">
                  {room.presenceDetected ? "Presence detected" : "No presence"}
                </div>
              </div>
              <div className="mt-4 space-y-2">
                {roomPatients.length === 0 && (
                  <p className="text-sm text-slate-500">No patients assigned to this room.</p>
                )}
                {roomPatients.map((patient) => (
                  <button
                    key={patient.patientId}
                    type="button"
                    className="w-full text-left bg-slate-50 hover:bg-slate-100 rounded-xl px-3 py-2 text-sm flex items-center justify-between"
                    onClick={() => onOpenPatient(patient.patientId)}
                  >
                    <span className="font-semibold">{patient.name}</span>
                    <span className="text-xs text-slate-500">{patient.risk}</span>
                  </button>
                ))}
              </div>
            </article>
          );
        })}
      </section>
    </>
  );
}
