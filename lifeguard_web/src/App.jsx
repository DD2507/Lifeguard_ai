import { useEffect, useState } from "react";
import { api } from "./api";
import AppShell from "./components/AppShell";
import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import PatientsPage from "./pages/PatientsPage";
import AlertsPage from "./pages/AlertsPage";
import RoomsPage from "./pages/RoomsPage";
import BedsPage from "./pages/BedsPage";
import PatientDetailPage from "./pages/PatientDetailPage";

const AUTH_KEY = "lifeguard.auth";

const PAGE_THEMES = {
  dashboard: "bg-[#f8faf4]",
  patients: "bg-[#e8f1fb]",
  alerts: "bg-[#fad2e1]",
  rooms: "bg-[#f8faf4]",
  beds: "bg-[#eaf5ea]",
  detail: "bg-[#f8faf4]"
};

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
  const [showPrescriptionForm, setShowPrescriptionForm] = useState(false);
  const [editingPrescriptionId, setEditingPrescriptionId] = useState(null);
  const [assignmentBed, setAssignmentBed] = useState(null);
  const [assignmentPatientId, setAssignmentPatientId] = useState("");
  const [prescriptionForm, setPrescriptionForm] = useState({
    treatmentName: "",
    type: "Medication",
    dosage: "",
    scheduledTime: "10:00 PM",
    frequency: "Once daily",
    startDate: new Date().toISOString().split("T")[0],
    duration: "3 days",
    instructions: ""
  });

  const flash = (text) => {
    setPrescriptionMessage(text);
    setTimeout(() => setPrescriptionMessage(""), 4000);
  };

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
    fetchAll();
    const interval = setInterval(fetchAll, 1500);
    return () => clearInterval(interval);
  }, [isLoggedIn]);

  useEffect(() => {
    if (!selectedPatient?.patientId) return undefined;
    const id = selectedPatient.patientId;
    fetchPrescriptions(id);
    const interval = setInterval(() => {
      fetchPatientDetails(id);
      fetchPrescriptions(id);
    }, 2000);
    return () => clearInterval(interval);
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
      startDate: new Date().toISOString().split("T")[0],
      duration: "3 days",
      instructions: ""
    });
    setEditingPrescriptionId(null);
    setShowPrescriptionForm(false);
  };

  const handleSavePrescription = async (event) => {
    event.preventDefault();
    if (!selectedPatient?.patientId) return;
    if (!prescriptionForm.treatmentName || !prescriptionForm.dosage || !prescriptionForm.scheduledTime) {
      flash("Please fill in Treatment Name, Dosage, and Scheduled Time.");
      return;
    }
    try {
      if (editingPrescriptionId) {
        await api.updatePrescription(editingPrescriptionId, prescriptionForm);
        flash("Prescription updated successfully!");
      } else {
        await api.createPrescription({
          ...prescriptionForm,
          patientId: selectedPatient.patientId,
          doctorId: "DOC-001"
        });
        flash("Prescription created successfully!");
      }
      resetPrescriptionForm();
      fetchPrescriptions(selectedPatient.patientId);
    } catch (err) {
      flash(err.message || "Failed to save prescription");
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
      connected={connected}
      pageTheme={PAGE_THEMES[page] || PAGE_THEMES.dashboard}
    >
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
          prescriptionMessage={prescriptionMessage}
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
              scheduledTime: item.scheduledTime || "10:00 PM",
              frequency: item.frequency || "Once daily",
              startDate: item.startDate
                ? new Date(item.startDate).toISOString().split("T")[0]
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
