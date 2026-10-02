import { useEffect, useRef, useState } from "react";
import { api } from "./api";
import AppShell from "./components/AppShell";
import { io } from "socket.io-client";
import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import PatientsPage from "./pages/PatientsPage";
import AlertsPage from "./pages/AlertsPage";
import RoomsPage from "./pages/RoomsPage";
import BedsPage from "./pages/BedsPage";
import PatientDetailPage from "./pages/PatientDetailPage";

const AUTH_KEY = "lifeguard.auth";

function getIndiaDateInputValue(value = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(value);
  const dateParts = Object.fromEntries(parts.map(({ type, value: part }) => [type, part]));
  return `${dateParts.year}-${dateParts.month}-${dateParts.day}`;
}

function getIndiaTimeInputValue(value) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  }).format(value);
}

const PAGE_THEMES = {
  dashboard: "bg-[#f8faf4]",
  patients: "bg-[#e8f1fb]",
  alerts: "bg-[#fad2e1]",
  rooms: "bg-[#f8faf4]",
  beds: "bg-[#eaf5ea]",
  detail: "bg-[#f8faf4]"
};

function playReminderChime() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(587.33, now);
    gain1.gain.setValueAtTime(0.2, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.3);

    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = "sine";
    osc2.frequency.setValueAtTime(880, now + 0.15);
    gain2.gain.setValueAtTime(0.25, now + 0.15);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.15);
    osc2.stop(now + 0.6);
  } catch {
    // Autoplay restrictions safely caught
  }
}

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(
    () => window.localStorage.getItem(AUTH_KEY) === "1"
  );
  const [patients, setPatients] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [alertHistory, setAlertHistory] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [beds, setBeds] = useState([]);
  const [activePage, setActivePage] = useState("dashboard");
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [digitalTwin, setDigitalTwin] = useState(null);
  const [simulationResult, setSimulationResult] = useState(null);
  const [scenario, setScenario] = useState("REDUCED_OXYGEN");
  const [manualInputs, setManualInputs] = useState({
    heartRate: "",
    spo2: "",
    temperature: "",
    roomTemperature: "",
    humidity: "",
    airQuality: ""
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [connected, setConnected] = useState(false);
  const [prescriptions, setPrescriptions] = useState([]);
  const [prescriptionsLoading, setPrescriptionsLoading] = useState(false);
  const [prescriptionMessage, setPrescriptionMessage] = useState("");
  const [toast, setToast] = useState(null);
  const [dueReminders, setDueReminders] = useState([]);
  const seenRemindersRef = useRef(new Set());
  const [showPrescriptionForm, setShowPrescriptionForm] = useState(false);
  const [editingPrescriptionId, setEditingPrescriptionId] = useState(null);
  const [assignmentBed, setAssignmentBed] = useState(null);
  const [assignmentPatientId, setAssignmentPatientId] = useState("");
  const [savingPrescription, setSavingPrescription] = useState(false);
  const savingPrescriptionRef = useRef(false);
  const socketRef = useRef(null);
  const [prescriptionForm, setPrescriptionForm] = useState({
    treatmentName: "",
    type: "Medication",
    dosage: "",
    scheduledTime: "10:00 PM",
    frequency: "Once daily",
    startDate: getIndiaDateInputValue(),
    duration: "3 days",
    instructions: ""
  });

  const flash = (text, type = "success") => {
    setPrescriptionMessage(text);
    setToast({ text, type });
  };

  useEffect(() => {
    if (!isLoggedIn) return undefined;

    const socket = io("http://localhost:5000", {
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      setConnected(true);
      // Socket.IO rooms are connection-scoped; rejoin after reconnects too.
      socket.emit("subscribe-dashboard");
    });

    socket.on("disconnect", () => {
      setConnected(false);
    });

    socket.on("patient-vitals-updated", (payload) => {
      setPatients((current) => current.map((patient) =>
        patient.patientId === payload.patientId ? { ...patient, ...payload } : patient
      ));
      setSelectedPatient((current) =>
        current?.patientId === payload.patientId ? { ...current, ...payload } : current
      );
    });

    socket.on("room-updated", (payload) => {
      setRooms((current) => {
        const matching = current.some((room) => String(room.roomId) === String(payload.roomId));
        const next = matching
          ? current.map((room) => String(room.roomId) === String(payload.roomId) ? { ...room, ...payload } : room)
          : [...current, payload];
        return next.sort((left, right) => String(left.roomId).localeCompare(String(right.roomId), undefined, { numeric: true }));
      });
    });

    socket.on("room-sensor-status", (payload) => {
      setRooms((current) => current.map((room) =>
        String(room.roomId) === String(payload.roomId) ? { ...room, ...payload } : room
      ));
    });

    socket.on("alert-created", (payload) => {
      if (payload.alertType !== "MEDICINE_DUE") {
        flash(`Alert: ${payload.risk} risk for patient ${payload.patientId}`);
      }
      setAlerts((current) => {
        const next = [payload, ...current.filter((item) => item._id !== payload._id)];
        return next;
      });
      setAlertHistory((current) => [payload, ...current.filter((item) => item._id !== payload._id)]);
    });

    socket.on("alert-updated", (payload) => {
      setAlerts((current) => current.map((item) => item._id === payload._id ? { ...item, ...payload } : item));
      setAlertHistory((current) => current.map((item) => item._id === payload._id ? { ...item, ...payload } : item));
    });

    socket.on("alert-completed", (payload) => {
      setAlerts((current) => current.filter((item) => item._id !== payload._id));
      setAlertHistory((current) => [payload, ...current.filter((item) => item._id !== payload._id)]);
      setDueReminders((current) => current.filter((item) =>
        (payload.occurrenceId && item.occurrenceId !== payload.occurrenceId) ||
        (!payload.occurrenceId && item.alertId !== payload._id && item._id !== payload._id)
      ));
    });

    socket.on("prescription-created", (payload) => {
      if (!savingPrescriptionRef.current) {
        flash(`Prescription created for patient ${payload.patientId}`);
      }
      setPrescriptions((current) => {
        const next = [payload, ...current.filter((item) => item._id !== payload._id)];
        return next;
      });
    });

    socket.on("medicine-due", (payload) => {
      const occurrenceId =
        payload.occurrenceId || `${payload._id}:${payload.scheduledAt || payload.scheduledTime}`;
      if (seenRemindersRef.current.has(occurrenceId)) {
        return;
      }
      seenRemindersRef.current.add(occurrenceId);

      playReminderChime();

      const dueTime = payload.dueTime ? ` Due ${payload.dueTime} IST.` : "";
      flash(
        `Medicine due: ${payload.treatmentName} — ${payload.dosage} for patient ${payload.patientId}.${dueTime}`,
        "reminder"
      );

      setDueReminders((current) => {
        if (current.some((item) => (item.occurrenceId || item._id) === occurrenceId)) {
          return current;
        }
        return [payload, ...current];
      });
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [isLoggedIn]);

  const fetchAll = async () => {
    try {
      const [nextPatients, nextAlerts, nextRooms, nextBeds, nextHistory] =
        await Promise.all([
          api.patients(),
          api.alerts(),
          api.rooms(),
          api.beds(),
          api.alertHistory().catch(() => [])
        ]);
      setPatients(nextPatients);
      setAlerts(nextAlerts);
      setRooms(nextRooms);
      setBeds(nextBeds);
      setAlertHistory(nextHistory);
      setConnected(true);
      setError("");
    } catch (err) {
      console.error(err);
      setConnected(false);
      setError("Unable to connect to LifeGuard AI server");
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteMedicine = async (alertId) => {
    try {
      const result = await api.resolveAlert(alertId);
      const completedAlert = result.alert;
      if (completedAlert?.alertType === "MEDICINE_DUE") {
        setAlerts((current) => current.filter((item) => item._id !== completedAlert._id));
        setAlertHistory((current) => [completedAlert, ...current.filter((item) => item._id !== completedAlert._id)]);
        setDueReminders((current) => current.filter((item) =>
          (completedAlert.occurrenceId && item.occurrenceId !== completedAlert.occurrenceId) ||
          (!completedAlert.occurrenceId && item.alertId !== completedAlert._id && item._id !== completedAlert._id)
        ));
        if (result.prescription) {
          setPrescriptions((current) => current.map((item) =>
            item._id === result.prescription._id ? result.prescription : item
          ));
        }
      }
      flash(result.message || "Medicine dose marked as completed.");
      return result;
    } catch (err) {
      flash(err.message || "Failed to complete medicine dose.", "error");
      throw err;
    }
  };

  const fetchPatientDetails = async (patientId) => {
    try {
      const data = await api.patient(patientId);
      setSelectedPatient(data);
      setActivePage("detail");
      try {
        setDigitalTwin(await api.digitalTwin(patientId));
      } catch (twinErr) {
        console.error(twinErr);
      }
    } catch (err) {
      console.error(err);
      setError("Unable to load patient details");
    }
  };

  const fetchPrescriptions = async (patientId) => {
    if (!patientId) return;
    try {
      setPrescriptionsLoading(true);
      setPrescriptions(await api.prescriptions(patientId));
    } catch (err) {
      console.error(err);
    } finally {
      setPrescriptionsLoading(false);
    }
  };

  useEffect(() => {
    if (!isLoggedIn) return undefined;
    const initialFetch = window.setTimeout(fetchAll, 0);
    const interval = setInterval(fetchAll, 1500);
    return () => {
      window.clearTimeout(initialFetch);
      clearInterval(interval);
    };
  }, [isLoggedIn]);

  useEffect(() => {
    if (!selectedPatient?.patientId) return undefined;
    const id = selectedPatient.patientId;
    const initialFetch = window.setTimeout(() => fetchPrescriptions(id), 0);
    const interval = setInterval(() => {
      fetchPatientDetails(id);
      fetchPrescriptions(id);
    }, 2000);
    return () => {
      window.clearTimeout(initialFetch);
      clearInterval(interval);
    };
  }, [selectedPatient?.patientId]);

  const handleLogin = (username, password) => {
    const validUser =
      username === "admin" ||
      username === "doctor@hospital.org" ||
      username.toLowerCase() === "admin@lifeguard.ai";
    if (validUser && password === "admin123") {
      window.localStorage.setItem(AUTH_KEY, "1");
      setIsLoggedIn(true);
      setError("");
      return true;
    }
    return false;
  };

  const handleLogout = () => {
    window.localStorage.removeItem(AUTH_KEY);
    setIsLoggedIn(false);
    setSelectedPatient(null);
    setActivePage("dashboard");
  };

  const goToPage = (page) => {
    setActivePage(page);
    setSelectedPatient(null);
    setSimulationResult(null);
    setError("");
  };

  const simulateWhatIf = async () => {
    if (!selectedPatient?.patientId) return;
    try {
      const payload = { scenario };
      Object.entries(manualInputs).forEach(([key, value]) => {
        if (value !== "") payload[key] = Number(value);
      });
      setSimulationResult(await api.whatIf(selectedPatient.patientId, payload));
    } catch (err) {
      setError(err.message || "Unable to simulate patient scenario");
    }
  };

  const resetPrescriptionForm = () => {
    setPrescriptionForm({
      treatmentName: "",
      type: "Medication",
      dosage: "",
      scheduledTime: "10:00 PM",
      frequency: "Once daily",
      startDate: getIndiaDateInputValue(),
      duration: "3 days",
      instructions: ""
    });
    setEditingPrescriptionId(null);
    setShowPrescriptionForm(false);
  };

  const handleSavePrescription = async (event) => {
    event.preventDefault();
    if (savingPrescriptionRef.current) return;
    if (!selectedPatient?.patientId) {
      flash("Select a patient before saving a prescription.", "error");
      return;
    }
    if (!prescriptionForm.treatmentName.trim() || !prescriptionForm.dosage.trim() || !prescriptionForm.scheduledTime.trim()) {
      flash("Please fill in Treatment Name, Dosage, and Scheduled Time.", "error");
      return;
    }

    savingPrescriptionRef.current = true;
    setSavingPrescription(true);

    try {
      if (editingPrescriptionId) {
        await api.updatePrescription(editingPrescriptionId, prescriptionForm);
      } else {
        await api.createPrescription({
          ...prescriptionForm,
          patientId: selectedPatient.patientId,
          doctorId: "DOC-001"
        });
      }
      resetPrescriptionForm();
      await fetchPrescriptions(selectedPatient.patientId);
      flash(editingPrescriptionId ? "Prescription updated successfully." : "Prescription saved successfully.");
    } catch (err) {
      flash(err.message || "Failed to save prescription", "error");
    } finally {
      savingPrescriptionRef.current = false;
      setSavingPrescription(false);
    }
  };

  const runBedAction = async (action, success) => {
    try {
      await action();
      setAssignmentBed(null);
      setAssignmentPatientId("");
      await fetchAll();
      flash(success);
    } catch (err) {
      flash(err.message);
    }
  };

  if (!isLoggedIn) {
    return <LoginPage onLogin={handleLogin} />;
  }

  const page = selectedPatient ? "detail" : activePage;

  return (
    <AppShell
      activePage={selectedPatient ? "patients" : activePage}
      onNavigate={goToPage}
      onLogout={handleLogout}
      alertCount={alerts.length}
      dueReminderCount={dueReminders.length}
      connected={connected}
      pageTheme={PAGE_THEMES[page] || PAGE_THEMES.dashboard}
    >
      {/* Real-time Scheduled Medicine Due Notifications */}
      {dueReminders.length > 0 && (
        <div
          className="fixed right-4 top-24 z-[120] flex flex-col gap-3 max-w-md w-full pointer-events-none"
          role="region"
          aria-label="Medicine Due Reminders"
        >
          {dueReminders.map((reminder) => {
            const id = reminder.occurrenceId || reminder._id;
            return (
              <div
                key={id}
                className="pointer-events-auto rounded-2xl border-2 border-amber-400 bg-amber-50 p-4 shadow-2xl ring-4 ring-amber-200/60 text-slate-900 transition-all"
                role="alert"
                aria-live="assertive"
              >
                <div className="flex items-center justify-between pb-2 border-b border-amber-200">
                  <div className="flex items-center gap-2">
                    <span className="flex h-3 w-3 relative">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-600" />
                    </span>
                    <span className="font-extrabold text-sm tracking-wider text-amber-950 uppercase">
                      MEDICINE DUE
                    </span>
                  </div>
                  <button
                    type="button"
                    className="text-xs font-bold px-2 py-1 rounded-md text-amber-800 hover:bg-amber-100 transition-colors"
                    onClick={() => {
                      setDueReminders((prev) => prev.filter((item) => (item.occurrenceId || item._id) !== id));
                    }}
                    aria-label="Dismiss medicine due alert"
                  >
                    Dismiss
                  </button>
                </div>
                <div className="mt-3 space-y-1 text-sm font-medium text-slate-800">
                  <p><span className="text-slate-500 font-semibold">Patient:</span> <strong className="text-slate-950 font-bold">{reminder.patientId}</strong></p>
                  <p><span className="text-slate-500 font-semibold">Medicine:</span> <strong className="text-slate-950 font-bold">{reminder.treatmentName}</strong></p>
                  <p><span className="text-slate-500 font-semibold">Dosage:</span> {reminder.dosage}</p>
                  <p><span className="text-slate-500 font-semibold">Scheduled time:</span> {reminder.dueTime || reminder.scheduledTime}</p>
                </div>
                <div className="mt-3 pt-2 flex items-center justify-end gap-2 border-t border-amber-200/60">
                  <button
                    type="button"
                    className="text-xs font-bold px-3.5 py-1.5 rounded-full bg-amber-900 text-white hover:bg-amber-950 transition-colors shadow-sm"
                    onClick={() => {
                      fetchPatientDetails(reminder.patientId);
                      setDueReminders((prev) => prev.filter((item) => (item.occurrenceId || item._id) !== id));
                    }}
                  >
                    View Patient
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {toast && (
        <div
          className={`fixed right-4 bottom-6 z-[100] flex max-w-md items-start gap-4 rounded-xl border px-4 py-3 text-sm shadow-lg ${
            toast.type === "error"
              ? "border-rose-200 bg-rose-50 text-rose-900"
              : toast.type === "reminder"
                ? "border-amber-300 bg-amber-50 text-amber-950 ring-2 ring-amber-200"
                : "border-emerald-200 bg-emerald-50 text-emerald-900"
          }`}
          role={toast.type === "error" || toast.type === "reminder" ? "alert" : "status"}
          aria-live={toast.type === "error" || toast.type === "reminder" ? "assertive" : "polite"}
        >
          <p className="flex-1">{toast.text}</p>
          <button
            type="button"
            className="font-semibold opacity-70 hover:opacity-100"
            aria-label="Dismiss notification"
            onClick={() => setToast(null)}
          >
            Dismiss
          </button>
        </div>
      )}
      {loading && <p className="text-sm text-slate-500">Loading patient data...</p>}
      {error && (
        <p className="text-sm text-rose-700 bg-rose-50 border border-rose-100 rounded-2xl px-4 py-3">
          {error}
        </p>
      )}

      {selectedPatient && (
        <PatientDetailPage
          patient={selectedPatient}
          digitalTwin={digitalTwin}
          simulationResult={simulationResult}
          scenario={scenario}
          setScenario={setScenario}
          manualInputs={manualInputs}
          onManualInput={(event) => {
            const { name, value } = event.target;
            setManualInputs((prev) => ({ ...prev, [name]: value }));
          }}
          onSimulate={simulateWhatIf}
          onBack={() => {
            setSelectedPatient(null);
            setActivePage("dashboard");
          }}
          prescriptions={prescriptions}
          prescriptionsLoading={prescriptionsLoading}
          savingPrescription={savingPrescription}
          showPrescriptionForm={showPrescriptionForm}
          setShowPrescriptionForm={setShowPrescriptionForm}
          prescriptionForm={prescriptionForm}
          onPrescriptionChange={(event) => {
            const { name, value } = event.target;
            setPrescriptionForm((prev) => ({ ...prev, [name]: value }));
          }}
          onSavePrescription={handleSavePrescription}
          resetPrescriptionForm={resetPrescriptionForm}
          editingPrescriptionId={editingPrescriptionId}
          onEditPrescription={(item) => {
            setEditingPrescriptionId(item._id);
            setPrescriptionForm({
              treatmentName: item.treatmentName || "",
              type: item.type || "Medication",
              dosage: item.dosage || "",
              scheduledTime: item.scheduledAt
                ? getIndiaTimeInputValue(new Date(item.scheduledAt))
                : item.scheduledTime || "10:00 PM",
              frequency: item.frequency || "Once daily",
              startDate: item.scheduledAt || item.startDate
                ? getIndiaDateInputValue(new Date(item.scheduledAt || item.startDate))
                : "",
              duration: item.duration || "",
              instructions: item.instructions || ""
            });
            setShowPrescriptionForm(true);
          }}
          onStatus={async (id, status) => {
            try {
              await api.prescriptionStatus(id, status);
              flash(`Prescription marked as ${status.toLowerCase()}!`);
              fetchPrescriptions(selectedPatient.patientId);
            } catch {
              flash("Failed to update prescription status");
            }
          }}
          onDelete={async (id) => {
            if (!window.confirm("Delete this prescription?")) return;
            try {
              await api.deletePrescription(id);
              flash("Prescription deleted successfully!");
              fetchPrescriptions(selectedPatient.patientId);
            } catch {
              flash("Failed to delete prescription");
            }
          }}
        />
      )}

      {!selectedPatient && activePage === "dashboard" && (
        <DashboardPage
          patients={patients}
          alerts={alerts}
          beds={beds}
          onOpenPatient={fetchPatientDetails}
          onCompleteMedicine={handleCompleteMedicine}
          onResolveAlert={async (id) => {
            try {
              await api.resolveAlert(id);
              flash("Alert acknowledged.");
              fetchAll();
            } catch (err) {
              flash(err.message);
            }
          }}
          onNavigate={goToPage}
        />
      )}

      {!selectedPatient && activePage === "patients" && (
        <PatientsPage patients={patients} onOpenPatient={fetchPatientDetails} />
      )}

      {!selectedPatient && activePage === "alerts" && (
        <AlertsPage
          alerts={alerts}
          history={alertHistory}
          onOpenPatient={fetchPatientDetails}
          onCompleteMedicine={handleCompleteMedicine}
          onResolveAlert={async (id) => {
            try {
              await api.resolveAlert(id);
              flash("Alert acknowledged.");
              fetchAll();
            } catch (err) {
              flash(err.message);
            }
          }}
        />
      )}

      {!selectedPatient && activePage === "rooms" && (
        <RoomsPage rooms={rooms} patients={patients} onOpenPatient={fetchPatientDetails} />
      )}

      {!selectedPatient && activePage === "beds" && (
        <BedsPage
          beds={beds}
          patients={patients}
          message={prescriptionMessage}
          assignmentBed={assignmentBed}
          assignmentPatientId={assignmentPatientId}
          setAssignmentBed={setAssignmentBed}
          setAssignmentPatientId={setAssignmentPatientId}
          assignBed={(bedId, patientId) =>
            runBedAction(() => api.assignBed(bedId, patientId), "Bed assigned successfully!")
          }
          releaseBed={(bedId) =>
            runBedAction(() => api.releaseBed(bedId), "Bed released successfully!")
          }
          setBedMaintenance={(bedId) =>
            runBedAction(() => api.bedMaintenance(bedId), "Bed marked under maintenance.")
          }
          setBedAvailable={(bedId) =>
            runBedAction(() => api.bedAvailable(bedId), "Bed marked as available.")
          }
          deleteBed={(bedId) =>
            runBedAction(() => api.deleteBed(bedId), "Bed deleted successfully.")
          }
          onOpenPatient={fetchPatientDetails}
        />
      )}
    </AppShell>
  );
}

export default App;
