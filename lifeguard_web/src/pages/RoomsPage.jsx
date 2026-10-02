import { useEffect, useRef, useState } from "react";

const TARGET_BASELINE_READINGS = 15;

function numericSensorValue(value) {
  if (value === null || value === undefined || String(value).trim() === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function averageReadings(readings, field) {
  const values = readings
    .map((reading) => reading[field])
    .filter((value) => Number.isFinite(value));
  if (!values.length) return null;
  return {
    average: values.reduce((total, value) => total + value, 0) / values.length,
    count: values.length
  };
}

function RoomBaseline({ room, isLive }) {
  const [collection, setCollection] = useState({ status: "idle", readings: [], baseline: null, message: "" });
  const readingsRef = useRef([]);
  const processedPublicationRef = useRef(null);

  useEffect(() => {
    if (collection.status !== "collecting" || !isLive || !room.lastValidReadingAt) return;

    const timestamp = new Date(room.lastValidReadingAt).getTime();
    const temperature = numericSensorValue(room.temperature);
    if (!Number.isFinite(timestamp) || temperature === null) return;

    const publicationKey = String(timestamp);
    if (processedPublicationRef.current === publicationKey) return;
    processedPublicationRef.current = publicationKey;

    const reading = {
      timestamp: publicationKey,
      temperature,
      humidity: numericSensorValue(room.humidity),
      airQuality: numericSensorValue(room.airQuality)
    };
    const readings = [...readingsRef.current, reading].slice(-TARGET_BASELINE_READINGS);
    readingsRef.current = readings;

    if (readings.length === TARGET_BASELINE_READINGS) {
      setCollection({
        status: "success",
        readings,
        baseline: {
          temperature: averageReadings(readings, "temperature"),
          humidity: averageReadings(readings, "humidity"),
          airQuality: averageReadings(readings, "airQuality")
        },
        message: `Baseline calculated from ${readings.length} valid IoT publications.`
      });
    } else {
      setCollection((current) => current.status === "collecting"
        ? { ...current, readings }
        : current);
    }
  }, [collection.status, isLive, room.lastValidReadingAt, room.temperature, room.humidity, room.airQuality]);

  const startCalculation = () => {
    if (!isLive) {
      setCollection({
        status: "error",
        readings: [],
        baseline: null,
        message: "A live room sensor is required. Connect the sensor and try again."
      });
      return;
    }

    readingsRef.current = [];
    processedPublicationRef.current = room.lastValidReadingAt
      ? String(new Date(room.lastValidReadingAt).getTime())
      : null;
    setCollection({ status: "collecting", readings: [], baseline: null, message: "" });
  };

  return (
    <section className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4" aria-label={`Room ${room.roomId} temperature baseline`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-semibold text-slate-900">Room Sensor Baseline</h3>
          <p className="text-xs text-slate-600">Waits for 15 valid readings published by the live IoT room sensor, then calculates the average.</p>
        </div>
        <button
          type="button"
          onClick={startCalculation}
          disabled={collection.status === "collecting"}
          className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:cursor-wait disabled:opacity-60"
        >
          {collection.status === "collecting"
            ? `Collecting readings... ${collection.readings.length}/${TARGET_BASELINE_READINGS}`
            : "Calculate Baseline"}
        </button>
      </div>

      {collection.status === "collecting" && (
        <p className="mt-3 text-sm text-slate-700" role="status">
          Collecting IoT publications ({collection.readings.length}/{TARGET_BASELINE_READINGS}). Repeated measurement values are accepted; calculation starts after all 15 publications arrive.
        </p>
      )}
      {collection.message && (
        <p className={`mt-3 text-sm ${collection.status === "error" ? "text-rose-700" : "text-emerald-800"}`} role={collection.status === "error" ? "alert" : "status"}>
          {collection.message}
        </p>
      )}
      {collection.baseline && (
        <div className="mt-3 grid grid-cols-1 gap-2 text-sm text-slate-800 sm:grid-cols-3">
          <p>Average temperature: <strong>{collection.baseline.temperature.average.toFixed(2)}°C</strong> ({collection.baseline.temperature.count} readings)</p>
          {collection.baseline.humidity && (
            <p>Average humidity: <strong>{collection.baseline.humidity.average.toFixed(2)}%</strong> ({collection.baseline.humidity.count} readings)</p>
          )}
          {collection.baseline.airQuality && (
            <p>Average MQ135 raw: <strong>{collection.baseline.airQuality.average.toFixed(2)}</strong> ({collection.baseline.airQuality.count} readings)</p>
          )}
        </div>
      )}
    </section>
  );
}

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
          const isLive = room.sensorStatus === "LIVE" && room.source === "MQTT";
          const sensorStatus = room.sensorStatus || "WAITING";
          const sensorMessage = sensorStatus === "DATA_STALE"
            ? "Room sensor data is stale. Waiting for a fresh MQTT reading."
            : sensorStatus === "SENSOR_INVALID"
              ? "Latest room sensor packet was invalid. Waiting for a valid reading."
              : "Waiting for room sensor data. Check the ESP32 publish topic and backend MQTT connection.";
          return (
            <article key={room.roomId} className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-3xl font-display text-slate-900">Room {room.roomId}</h2>
                  <p className="text-sm text-slate-500">{roomPatients.length} patient{roomPatients.length === 1 ? "" : "s"}</p>
                </div>
                <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${isLive ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-amber-200 bg-amber-50 text-amber-900"}`}>
                  {isLive ? "LIVE SENSOR" : sensorStatus}
                </span>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                <div className="bg-slate-50 rounded-xl p-3">Temperature {isLive ? `${room.temperature}°C` : "--"}</div>
                <div className="bg-slate-50 rounded-xl p-3">Humidity {isLive ? `${room.humidity}%` : "--"}</div>
                <div className="bg-slate-50 rounded-xl p-3">MQ135 raw {isLive ? room.airQuality : "--"}</div>
                <div className="bg-slate-50 rounded-xl p-3">
                  {room.presenceDetected == null ? "Presence unavailable" : room.presenceDetected ? "Presence detected" : "No presence"}
                </div>
              </div>
              <div className="mt-3 space-y-1 text-xs text-slate-600">
                <p>Last valid reading: {room.lastValidReadingAt ? new Date(room.lastValidReadingAt).toLocaleString() : "Never"}</p>
                {room.lastSensorError && <p className="text-amber-800">{room.lastSensorError}</p>}
                {!isLive && <p>{sensorMessage}</p>}
              </div>
              <RoomBaseline room={room} isLive={isLive} />
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
