import { useEffect, useState } from "react";
import "./App.css";

const API_BASE = "http://localhost:5000/api";

function App() {
  const [patients, setPatients] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [beds, setBeds] = useState([]);

  const [activePage, setActivePage] = useState("dashboard");
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
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

  // Prescriptions state
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

  // =====================================================
  // FETCH PATIENTS
  // =====================================================

  const fetchPatients = async () => {
    try {
      const response = await fetch(
        `${API_BASE}/patients`
      );

      if (!response.ok) {
        throw new Error("Failed to fetch patients");
      }

      const data = await response.json();

      setPatients(data);
      setError("");
    } catch (err) {
      console.error(err);
      setError(
        "Unable to connect to LifeGuard AI server"
      );
    } finally {
      setLoading(false);
    }
  };


  // =====================================================
  // FETCH ALERTS
  // =====================================================

  const fetchAlerts = async () => {
    try {
      const response = await fetch(
        `${API_BASE}/alerts`
      );

      if (!response.ok) {
        throw new Error("Failed to fetch alerts");
      }

      const data = await response.json();

      setAlerts(data);
    } catch (err) {
      console.error("Alert fetch error:", err);
    }
  };


  // =====================================================
  // FETCH ROOMS
  // =====================================================

  const fetchRooms = async () => {
    try {
      const response = await fetch(
        `${API_BASE}/rooms`
      );

      if (!response.ok) {
        throw new Error("Failed to fetch rooms");
      }

      const data = await response.json();

      setRooms(data);
    } catch (err) {
      console.error("Room fetch error:", err);
    }
  };

  const fetchBeds = async () => {
    try {
      const response = await fetch(`${API_BASE}/beds`);

      if (!response.ok) {
        throw new Error("Failed to fetch beds");
      }

      const data = await response.json();
      setBeds(data);
    } catch (err) {
      console.error("Bed fetch error:", err);
      setError("Unable to load beds");
    }
  };


  // =====================================================
  // FETCH PATIENT DETAILS
  // =====================================================

  const fetchPatientDetails = async (patientId) => {
    try {
      const response = await fetch(
        `${API_BASE}/patients/${patientId}`
      );

      if (!response.ok) {
        throw new Error("Patient not found");
      }

      const data = await response.json();

      setSelectedPatient(data);
      setError("");

      try {
        const twinResponse = await fetch(`${API_BASE}/patients/${patientId}/digital-twin`);
        if (twinResponse.ok) {
          const twinData = await twinResponse.json();
          setDigitalTwin(twinData);
        }
      } catch (digitalTwinErr) {
        console.error("Digital twin fetch error:", digitalTwinErr);
      }
    } catch (err) {
      console.error(err);

      setError(
        "Unable to load patient details"
      );
    }
  };

  const simulateWhatIf = async () => {
    if (!selectedPatient?.patientId) return;

    try {
      const payload = {};
      if (scenario) payload.scenario = scenario;

      Object.entries(manualInputs).forEach(([key, value]) => {
        if (value !== "") {
          payload[key] = Number(value);
        }
      });

      const response = await fetch(`${API_BASE}/patients/${selectedPatient.patientId}/what-if`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Simulation failed");
      }

      const data = await response.json();
      setSimulationResult(data);
    } catch (err) {
      console.error("Simulation error:", err);
      setError(err.message || "Unable to simulate patient scenario");
    }
  };

  const handleManualInputChange = (event) => {
    const { name, value } = event.target;
    setManualInputs((prev) => ({ ...prev, [name]: value }));
  };

  // =====================================================
  // INITIAL DATA + LIVE POLLING
  // =====================================================

  useEffect(() => {
    fetchPatients();
    fetchAlerts();
    fetchRooms();
    fetchBeds();

    const interval = setInterval(() => {
      fetchPatients();
      fetchAlerts();
      fetchRooms();
      fetchBeds();
    }, 1500);

    return () => clearInterval(interval);
  }, []);


  // =====================================================
  // LIVE PATIENT DETAILS
  // =====================================================

  useEffect(() => {
    if (!selectedPatient?.patientId) {
      return;
    }

    const currentPatientId = selectedPatient.patientId;
    fetchPrescriptions(currentPatientId);

    const interval = setInterval(() => {
      fetchPatientDetails(currentPatientId);
      fetchPrescriptions(currentPatientId);
    }, 2000);

    return () => clearInterval(interval);
  }, [selectedPatient?.patientId]);

  // =====================================================
  // PRESCRIPTION HANDLERS
  // =====================================================

  const fetchPrescriptions = async (patientId) => {
    if (!patientId) return;
    try {
      setPrescriptionsLoading(true);
      const response = await fetch(`${API_BASE}/prescriptions/patient/${patientId}`);
      if (!response.ok) {
        throw new Error("Failed to fetch prescriptions");
      }
      const data = await response.json();
      setPrescriptions(data);
    } catch (err) {
      console.error("Prescription fetch error:", err);
    } finally {
      setPrescriptionsLoading(false);
    }
  };

  const handlePrescriptionFormChange = (e) => {
    const { name, value } = e.target;
    setPrescriptionForm((prev) => ({
      ...prev,
      [name]: value
    }));
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

  const handleSavePrescription = async (e) => {
    e.preventDefault();
    if (!selectedPatient?.patientId) return;

    if (!prescriptionForm.treatmentName || !prescriptionForm.dosage || !prescriptionForm.scheduledTime) {
      setPrescriptionMessage("Please fill in Treatment Name, Dosage, and Scheduled Time.");
      return;
    }

    try {
      let response;
      if (editingPrescriptionId) {
        response = await fetch(`${API_BASE}/prescriptions/${editingPrescriptionId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(prescriptionForm)
        });
      } else {
        response = await fetch(`${API_BASE}/prescriptions`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...prescriptionForm,
            patientId: selectedPatient.patientId,
            doctorId: "DOC-001"
          })
        });
      }

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "Failed to save prescription");
      }

      setPrescriptionMessage(
        editingPrescriptionId
          ? "Prescription updated successfully!"
          : "Prescription created successfully!"
      );
      setTimeout(() => setPrescriptionMessage(""), 4000);
      resetPrescriptionForm();
      fetchPrescriptions(selectedPatient.patientId);
    } catch (err) {
      console.error("Error saving prescription:", err);
      setPrescriptionMessage(err.message || "Failed to save prescription");
    }
  };

  const handleEditPrescription = (p) => {
    setEditingPrescriptionId(p._id);
    setPrescriptionForm({
      treatmentName: p.treatmentName || "",
      type: p.type || "Medication",
      dosage: p.dosage || "",
      scheduledTime: p.scheduledTime || "10:00 PM",
      frequency: p.frequency || "Once daily",
      startDate: p.startDate ? new Date(p.startDate).toISOString().split("T")[0] : "",
      duration: p.duration || "",
      instructions: p.instructions || ""
    });
    setShowPrescriptionForm(true);
    setPrescriptionMessage("");
  };

  const handleUpdatePrescriptionStatus = async (id, status) => {
    try {
      const response = await fetch(`${API_BASE}/prescriptions/${id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status })
      });
      if (!response.ok) {
        throw new Error("Failed to update status");
      }
      setPrescriptionMessage(`Prescription marked as ${status.toLowerCase()}!`);
      setTimeout(() => setPrescriptionMessage(""), 4000);
      fetchPrescriptions(selectedPatient.patientId);
    } catch (err) {
      console.error("Error updating status:", err);
      setPrescriptionMessage("Failed to update prescription status");
    }
  };

  const handleDeletePrescription = async (id) => {
    if (!window.confirm("Are you sure you want to delete this prescription?")) return;
    try {
      const response = await fetch(`${API_BASE}/prescriptions/${id}`, {
        method: "DELETE"
      });
      if (!response.ok) {
        throw new Error("Failed to delete prescription");
      }
      setPrescriptionMessage("Prescription deleted successfully!");
      setTimeout(() => setPrescriptionMessage(""), 4000);
      fetchPrescriptions(selectedPatient.patientId);
    } catch (err) {
      console.error("Error deleting prescription:", err);
      setPrescriptionMessage("Failed to delete prescription");
    }
  };

  const assignBed = async (bedId, patientId) => {
    try {
      const response = await fetch(`${API_BASE}/beds/${bedId}/assign`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ patientId })
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "Failed to assign bed");
      }

      setAssignmentBed(null);
      setAssignmentPatientId("");
      await fetchBeds();
      setError("");
      setPrescriptionMessage("Bed assigned successfully!");
      setTimeout(() => setPrescriptionMessage(""), 4000);
    } catch (err) {
      console.error("Assign bed error:", err);
      setPrescriptionMessage(err.message || "Failed to assign bed");
    }
  };

  const releaseBed = async (bedId) => {
    try {
      const response = await fetch(`${API_BASE}/beds/${bedId}/release`, {
        method: "PATCH"
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "Failed to release bed");
      }

      await fetchBeds();
      setPrescriptionMessage("Bed released successfully!");
      setTimeout(() => setPrescriptionMessage(""), 4000);
    } catch (err) {
      console.error("Release bed error:", err);
      setPrescriptionMessage(err.message || "Failed to release bed");
    }
  };

  const setBedMaintenance = async (bedId) => {
    try {
      const response = await fetch(`${API_BASE}/beds/${bedId}/maintenance`, {
        method: "PATCH"
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "Failed to set maintenance");
      }

      await fetchBeds();
      setPrescriptionMessage("Bed marked under maintenance.");
      setTimeout(() => setPrescriptionMessage(""), 4000);
    } catch (err) {
      console.error("Maintenance bed error:", err);
      setPrescriptionMessage(err.message || "Failed to update maintenance status");
    }
  };

  const setBedAvailable = async (bedId) => {
    try {
      const response = await fetch(`${API_BASE}/beds/${bedId}/available`, {
        method: "PATCH"
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "Failed to mark available");
      }

      await fetchBeds();
      setPrescriptionMessage("Bed marked as available.");
      setTimeout(() => setPrescriptionMessage(""), 4000);
    } catch (err) {
      console.error("Set available error:", err);
      setPrescriptionMessage(err.message || "Failed to mark bed available");
    }
  };

  const deleteBed = async (bedId) => {
    try {
      const response = await fetch(`${API_BASE}/beds/${bedId}`, {
        method: "DELETE"
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "Failed to delete bed");
      }

      await fetchBeds();
      setPrescriptionMessage("Bed deleted successfully.");
      setTimeout(() => setPrescriptionMessage(""), 4000);
    } catch (err) {
      console.error("Delete bed error:", err);
      setPrescriptionMessage(err.message || "Failed to delete bed");
    }
  };


  // =====================================================
  // HELPERS
  // =====================================================

  const getRiskClass = (risk) => {
    if (!risk) {
      return "low";
    }

    return risk.toLowerCase();
  };


  const highRiskPatients = patients.filter(
    (patient) =>
      patient.risk === "HIGH"
  );


  const moderateRiskPatients = patients.filter(
    (patient) =>
      patient.risk === "MODERATE"
  );


  const handleLogin = (username, password) => {
    if (username === "admin" && password === "admin123") {
      setIsLoggedIn(true);
      setError("");
      return true;
    }
    return false;
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setSelectedPatient(null);
    setActivePage("dashboard");
    setError("");
  };

  const goToPage = (page) => {
    setActivePage(page);
    setSelectedPatient(null);
    setError("");
  };


  // =====================================================
  // PATIENT CARD
  // =====================================================

  const PatientCard = ({ patient }) => (
    <div
      className="patient-card clickable"
      onClick={() =>
        fetchPatientDetails(
          patient.patientId
        )
      }
    >
      <div className="patient-header">

        <div className="patient-info">

          <div className="patient-number">
            {patient.patientId.replace(
              "P",
              ""
            )}
          </div>

          <div>
            <h3>{patient.name}</h3>
            <p>Room {patient.room}</p>
          </div>

        </div>

        <span
          className={`risk ${getRiskClass(
            patient.risk
          )}`}
        >
          {patient.risk} RISK
        </span>

      </div>


      <div className="vitals">

        <div className="vital">
          <span>♥</span>

          <div>
            <strong>
              {patient.heartRate} BPM
            </strong>

            <small>
              Heart Rate
            </small>
          </div>
        </div>


        <div className="vital">
          <span>≋</span>

          <div>
            <strong>
              {patient.spo2}%
            </strong>

            <small>
              SpO₂
            </small>
          </div>
        </div>


        <div className="vital">
          <span>♨</span>

          <div>
            <strong>
              {patient.temperature}°C
            </strong>

            <small>
              Temperature
            </small>
          </div>
        </div>

      </div>


      <div className="view-details">
        View Patient Details →
      </div>

    </div>
  );


  // =====================================================
  // ALERT CARD
  // =====================================================

  const AlertCard = ({ alert }) => (
    <div
      className={`alert-card ${getRiskClass(
        alert.risk
      )}`}
      onClick={() =>
        fetchPatientDetails(
          alert.patientId
        )
      }
    >

      <div className="alert-icon">
        ⚠
      </div>


      <div className="alert-content">

        <div className="alert-top">

          <div>
            <h3>
              {alert.patientName}
            </h3>

            <p>
              Room {alert.room}
            </p>
          </div>


          <span
            className={`risk ${getRiskClass(
              alert.risk
            )}`}
          >
            {alert.risk}
          </span>

        </div>


        <div className="alert-vitals">

          <span>
            ♥ {alert.reasons?.find(
              (r) =>
                r.factor === "Heart Rate"
            )?.value ?? "--"} BPM
          </span>

          <span>
            ≋ {alert.reasons?.find(
              (r) =>
                r.factor === "SpO₂"
            )?.value ?? "--"}% SpO₂
          </span>

          <span>
            ♨ {alert.reasons?.find(
              (r) =>
                r.factor === "Temperature"
            )?.value ?? "--"}°C
          </span>

        </div>


        <p className="alert-message">
          {alert.summary ||
            "Immediate attention recommended."}
        </p>

      </div>

    </div>
  );


  // =====================================================
  // PATIENT DETAILS PAGE
  // =====================================================

  if (!isLoggedIn) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  if (selectedPatient) {
    return (
      <div className="app">

        <header className="header">

          <div>
            <h1>LifeGuard AI</h1>
            <p>
              Patient Care Intelligence
            </p>
          </div>

                    <button className="logout-button" onClick={handleLogout}>
            Logout
          </button>



          <div className="status">
            <span className="status-dot"></span>
            Live Monitoring
          </div>

        </header>


        <main>

          <button
            className="back-button"
            onClick={() => {
              setSelectedPatient(null);
              setError("");
            }}
          >
            ← Back to Dashboard
          </button>


          {/* PATIENT TITLE */}

          <div className="details-title">

            <div>
              <h2>
                Patient Details
              </h2>

              <p>
                Live patient monitoring and AI
                risk assessment
              </p>
            </div>


            <span
              className={`risk ${getRiskClass(
                selectedPatient.risk
              )}`}
            >
              {selectedPatient.risk} RISK
            </span>

          </div>


          {/* PATIENT PROFILE */}

          <section className="patient-profile">

            <div className="patient-number large">
              {selectedPatient.patientId.replace(
                "P",
                ""
              )}
            </div>


            <div>

              <h2>
                {selectedPatient.name}
              </h2>

              <p>
                Patient ID:{" "}
                {selectedPatient.patientId}
              </p>

              <p>
                Room {selectedPatient.room}
              </p>

            </div>

          </section>


          {/* LIVE VITALS */}

          <h2 className="page-section-title">
            Live Vitals
          </h2>


          <section className="detail-vitals">

            <div className="detail-vital">

              <span className="vital-icon">
                ♥
              </span>

              <p>
                Heart Rate
              </p>

              <strong>
                {selectedPatient.heartRate} BPM
              </strong>

              <small>
                Current heart rate
              </small>

            </div>


            <div className="detail-vital">

              <span className="vital-icon">
                ≋
              </span>

              <p>
                SpO₂
              </p>

              <strong>
                {selectedPatient.spo2}%
              </strong>

              <small>
                Oxygen saturation
              </small>

            </div>


            <div className="detail-vital">

              <span className="vital-icon">
                ♨
              </span>

              <p>
                Body Temperature
              </p>

              <strong>
                {selectedPatient.temperature}°C
              </strong>

              <small>
                Current temperature
              </small>

            </div>

          </section>


          {/* ROOM CONTEXT */}

          <h2 className="page-section-title">
            Room Environment
          </h2>


          <section className="detail-vitals">

            <div className="detail-vital">

              <span className="vital-icon">
                🌡️
              </span>

              <p>
                Room Temperature
              </p>

              <strong>
                {selectedPatient.roomContext?.temperature ??
                  "--"}°C
              </strong>

              <small>
                Environmental temperature
              </small>

            </div>


            <div className="detail-vital">

              <span className="vital-icon">
                💧
              </span>

              <p>
                Humidity
              </p>

              <strong>
                {selectedPatient.roomContext?.humidity ??
                  "--"}%
              </strong>

              <small>
                Room humidity
              </small>

            </div>


            <div className="detail-vital">

              <span className="vital-icon">
                🌬️
              </span>

              <p>
                Air Quality
              </p>

              <strong>
                {selectedPatient.roomContext?.airQuality ??
                  "--"}
              </strong>

              <small>
                MQ135 sensor indicator
              </small>

            </div>

          </section>


          {/* PATIENT DIGITAL TWIN */}
          <h2 className="page-section-title">Patient Digital Twin</h2>
          <section className="digital-twin-panel">
            {digitalTwin ? (
              <>
                <div className="digital-twin-grid">
                  <div className="digital-twin-card">
                    <h4>Current physiological state</h4>
                    <p>HR: {digitalTwin.currentState?.heartRate ?? "--"} bpm</p>
                    <p>SpO₂: {digitalTwin.currentState?.spo2 ?? "--"}%</p>
                    <p>Temp: {digitalTwin.currentState?.temperature ?? "--"}°C</p>
                  </div>
                  <div className="digital-twin-card">
                    <h4>Personal baseline</h4>
                    <p>HR: {digitalTwin.baseline?.heartRate ?? "--"}</p>
                    <p>SpO₂: {digitalTwin.baseline?.spo2 ?? "--"}%</p>
                    <p>Temp: {digitalTwin.baseline?.temperature ?? "--"}°C</p>
                  </div>
                  <div className="digital-twin-card">
                    <h4>Trend</h4>
                    <p>HR: {digitalTwin.trends?.heartRate?.label ?? "N/A"}</p>
                    <p>SpO₂: {digitalTwin.trends?.spo2?.label ?? "N/A"}</p>
                    <p>Temp: {digitalTwin.trends?.temperature?.label ?? "N/A"}</p>
                  </div>
                </div>
                <p className="digital-twin-note">{digitalTwin.dataQuality?.message || "Personal baseline quality is currently unknown."}</p>
              </>
            ) : (
              <div className="no-alerts">Loading digital twin…</div>
            )}
          </section>

          {/* WHAT-IF SIMULATOR */}
          <h2 className="page-section-title">What-If Simulator</h2>
          <section className="digital-twin-panel">
            <div className="scenario-controls">
              <label>
                Scenario
                <select value={scenario} onChange={(e) => setScenario(e.target.value)}>
                  <option value="REDUCED_OXYGEN">Reduced Oxygen</option>
                  <option value="FEVER_LIKE">Fever-Like</option>
                  <option value="ELEVATED_HEART_RATE">Elevated Heart Rate</option>
                  <option value="COMBINED_DETERIORATION">Combined Deterioration</option>
                  <option value="POOR_ROOM_ENVIRONMENT">Poor Room Environment</option>
                </select>
              </label>
            </div>

            <div className="manual-sim-grid">
              <input type="number" name="heartRate" placeholder="Heart Rate" value={manualInputs.heartRate} onChange={handleManualInputChange} />
              <input type="number" name="spo2" placeholder="SpO₂" value={manualInputs.spo2} onChange={handleManualInputChange} />
              <input type="number" name="temperature" placeholder="Temperature" value={manualInputs.temperature} onChange={handleManualInputChange} />
              <input type="number" name="roomTemperature" placeholder="Room Temp" value={manualInputs.roomTemperature} onChange={handleManualInputChange} />
              <input type="number" name="humidity" placeholder="Humidity" value={manualInputs.humidity} onChange={handleManualInputChange} />
              <input type="number" name="airQuality" placeholder="Air Quality" value={manualInputs.airQuality} onChange={handleManualInputChange} />
            </div>

            <button className="action-button primary-rx-btn" onClick={simulateWhatIf}>Simulate Scenario</button>

            <div className="simulation-only-note">
              Simulation only — this estimates how physiological indicators and the AI risk score could change under the selected scenario. It does not predict an actual clinical outcome or provide a diagnosis.
            </div>

            {simulationResult && (
              <div className="simulation-result">
                <h4>Simulated result</h4>
                <p>Scenario: {simulationResult.scenario?.name || "Manual"}</p>
                <p>Simulated SpO₂: {simulationResult.simulatedState?.spo2 ?? "--"}% | Deviation: {simulationResult.deviations?.spo2 ?? "--"}</p>
                <p>Simulated Risk: {simulationResult.simulatedRisk?.risk ?? "--"} | Score: {simulationResult.simulatedRisk?.riskScore ?? "--"}</p>
                <p>{simulationResult.simulatedRisk?.riskSummary || "No risk summary available."}</p>
                {simulationResult.simulatedRisk?.riskReasons?.length > 0 && (
                  <ul>
                    {simulationResult.simulatedRisk.riskReasons.slice(0, 3).map((reason, index) => (
                      <li key={`${reason.factor}-${index}`}>
                        <strong>{reason.factor}</strong>: {reason.explanation}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </section>

          {/* AI RISK ANALYSIS */}

          <h2 className="page-section-title">
            AI Risk Analysis
          </h2>


          <section
            className={`risk-analysis ${getRiskClass(
              selectedPatient.risk
            )}`}
          >

            <div>

              <p>
                Current Risk Assessment
              </p>

              <h2>
                {selectedPatient.risk} RISK
              </h2>

              <p>
                Risk Score:{" "}
                {selectedPatient.riskScore}
              </p>

            </div>


            <div className="risk-message">

              {selectedPatient.risk === "HIGH"
                ? "Immediate attention recommended."
                : selectedPatient.risk ===
                  "MODERATE"
                ? "Continue close monitoring."
                : "Patient currently appears stable."}

            </div>

          </section>


          {/* WHY IS THE PATIENT AT RISK? */}

          <h2 className="page-section-title">
            Explainable AI — SHAP Feature Attributions
          </h2>
          {selectedPatient.source && (
            <div style={{ marginBottom: "15px", fontSize: "0.9rem", color: "#60a5fa", fontWeight: 600 }}>
              🧠 Engine: {selectedPatient.source}
            </div>
          )}


          <section className="risk-reasons">

            {selectedPatient.riskReasons &&
            selectedPatient.riskReasons.length > 0 ? (

              selectedPatient.riskReasons.map(
                (reason, index) => (

                  <div
                    className={`risk-reason ${getRiskClass(
                      reason.severity
                    )}`}
                    key={`${reason.factor}-${index}`}
                  >

                    <div className="reason-header">

                      <strong>
                        {reason.factor}
                      </strong>

                      <span style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                        {reason.impactPct !== undefined && (
                          <small style={{ fontWeight: "bold", opacity: 0.9 }}>
                            {reason.impactPct > 0 ? `+${reason.impactPct}%` : `${reason.impactPct}%`} SHAP
                          </small>
                        )}
                        <span>{reason.severity}</span>
                      </span>

                    </div>


                    <p>
                      Value:{" "}
                      {reason.value}
                    </p>


                    <p>
                      {reason.explanation}
                    </p>

                  </div>

                )
              )

            ) : (

              <div className="no-alerts">
                No contributing risk factors
                detected.
              </div>

            )}

          </section>


          {/* RISK SUMMARY */}

          <section className="risk-analysis">

            <div>

              <p>
                AI Reasoning Summary
              </p>

              <p>
                {selectedPatient.riskSummary ||
                  "No risk explanation available."}
              </p>

            </div>

          </section>


          {/* RECOMMENDED ACTION */}

          <h2 className="page-section-title">
            Recommended Room Action
          </h2>


          <section className="risk-analysis">

            <div>

              <p>
                AI Recommended Response
              </p>

              <h2>

                Fan:{" "}
                {selectedPatient
                  .recommendedAction?.fan
                  ? "ON"
                  : "OFF"}

                {"  |  "}

                Buzzer:{" "}
                {selectedPatient
                  .recommendedAction?.buzzer
                  ? "ON"
                  : "OFF"}

              </h2>

              <p>

                {selectedPatient
                  .recommendedAction?.reason ||
                  "No immediate room intervention is required."}

              </p>

            </div>

          </section>

          {/* =====================================================
             DOCTOR PRESCRIPTIONS & TREATMENT REMINDERS
          ===================================================== */}
          <section className="detail-section prescriptions-section">
            <div className="prescriptions-header">
              <div>
                <h3>Doctor Prescriptions & Treatment Plan</h3>
                <p className="section-subtitle">
                  Manage patient medications, IV fluids, dosages, and scheduled reminder times
                </p>
              </div>

              <button
                className="action-button primary-rx-btn"
                onClick={() => {
                  if (showPrescriptionForm && !editingPrescriptionId) {
                    resetPrescriptionForm();
                  } else {
                    resetPrescriptionForm();
                    setShowPrescriptionForm(true);
                  }
                }}
              >
                {showPrescriptionForm && !editingPrescriptionId
                  ? "✕ Close Form"
                  : "+ Add Treatment / Prescription"}
              </button>
            </div>

            {prescriptionMessage && (
              <div
                className={`prescription-banner ${
                  prescriptionMessage.toLowerCase().includes("error") ||
                  prescriptionMessage.toLowerCase().includes("failed") ||
                  prescriptionMessage.toLowerCase().includes("please")
                    ? "banner-error"
                    : "banner-success"
                }`}
              >
                {prescriptionMessage}
              </div>
            )}

            {/* PRESCRIPTION FORM */}
            {showPrescriptionForm && (
              <form
                className="prescription-form"
                onSubmit={handleSavePrescription}
              >
                <div className="form-header">
                  <h4>
                    {editingPrescriptionId
                      ? "Edit Treatment / Prescription"
                      : "Create Doctor Prescription"}
                  </h4>
                  <span className="patient-pill">
                    Patient: {selectedPatient.patientId} ({selectedPatient.name})
                  </span>
                </div>

                <div className="form-grid">
                  <div className="form-group">
                    <label>Treatment / Medicine Name *</label>
                    <input
                      type="text"
                      name="treatmentName"
                      placeholder="e.g. Glucose IV, Paracetamol"
                      value={prescriptionForm.treatmentName}
                      onChange={handlePrescriptionFormChange}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label>Treatment Type</label>
                    <select
                      name="type"
                      value={prescriptionForm.type}
                      onChange={handlePrescriptionFormChange}
                    >
                      <option value="Medication">Medication</option>
                      <option value="IV Fluid">IV Fluid</option>
                      <option value="Injection">Injection</option>
                      <option value="Therapy">Therapy</option>
                      <option value="Vital Check">Vital Check</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Dosage *</label>
                    <input
                      type="text"
                      name="dosage"
                      placeholder="e.g. 500 ml, 500 mg, 1 tablet"
                      value={prescriptionForm.dosage}
                      onChange={handlePrescriptionFormChange}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label>Scheduled Time *</label>
                    <input
                      type="text"
                      name="scheduledTime"
                      placeholder="e.g. 10:00 PM or 22:00"
                      value={prescriptionForm.scheduledTime}
                      onChange={handlePrescriptionFormChange}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label>Frequency</label>
                    <select
                      name="frequency"
                      value={prescriptionForm.frequency}
                      onChange={handlePrescriptionFormChange}
                    >
                      <option value="Once only">Once only</option>
                      <option value="Once daily">Once daily</option>
                      <option value="Twice daily">Twice daily</option>
                      <option value="Three times daily">Three times daily</option>
                      <option value="Every 8 hours">Every 8 hours</option>
                      <option value="Every 12 hours">Every 12 hours</option>
                      <option value="As needed">As needed</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Duration / Length</label>
                    <input
                      type="text"
                      name="duration"
                      placeholder="e.g. 3 days, 1 week"
                      value={prescriptionForm.duration}
                      onChange={handlePrescriptionFormChange}
                    />
                  </div>

                  <div className="form-group">
                    <label>Start Date</label>
                    <input
                      type="date"
                      name="startDate"
                      value={prescriptionForm.startDate}
                      onChange={handlePrescriptionFormChange}
                    />
                  </div>

                  <div className="form-group full-width">
                    <label>Instructions / Clinical Notes</label>
                    <textarea
                      name="instructions"
                      rows="2"
                      placeholder="e.g. Administer slowly. Monitor SpO2 and vitals."
                      value={prescriptionForm.instructions}
                      onChange={handlePrescriptionFormChange}
                    />
                  </div>
                </div>

                <div className="form-actions">
                  <button type="submit" className="save-btn">
                    {editingPrescriptionId
                      ? "Update Prescription"
                      : "Save & Prescribe"}
                  </button>
                  <button
                    type="button"
                    className="cancel-btn"
                    onClick={resetPrescriptionForm}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}

            {/* LIST OF PRESCRIPTIONS */}
            <div className="prescriptions-list">
              {prescriptionsLoading && prescriptions.length === 0 ? (
                <div className="prescriptions-empty">Loading prescriptions...</div>
              ) : prescriptions.length === 0 ? (
                <div className="prescriptions-empty">
                  No prescriptions recorded for this patient. Click "+ Add Treatment / Prescription" above to prescribe medications.
                </div>
              ) : (
                prescriptions.map((p) => (
                  <div
                    key={p._id}
                    className={`prescription-card status-${p.status.toLowerCase()}`}
                  >
                    <div className="prescription-card-header">
                      <div>
                        <div className="prescription-title-row">
                          <span className="rx-badge">Rx</span>
                          <h4>{p.treatmentName}</h4>
                          <span className="type-tag">{p.type}</span>
                          <span className={`prescription-status-badge ${p.status.toLowerCase()}`}>
                            {p.status}
                          </span>
                        </div>
                        <div className="prescription-meta">
                          <span><strong>Dosage:</strong> {p.dosage}</span>
                          <span>•</span>
                          <span><strong>Time:</strong> ⏰ {p.scheduledTime}</span>
                          <span>•</span>
                          <span><strong>Frequency:</strong> {p.frequency}</span>
                          {p.duration && (
                            <>
                              <span>•</span>
                              <span><strong>Duration:</strong> {p.duration}</span>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="prescription-card-actions">
                        {p.status === "ACTIVE" && (
                          <>
                            <button
                              className="btn-complete"
                              title="Mark this treatment as completed"
                              onClick={() => handleUpdatePrescriptionStatus(p._id, "COMPLETED")}
                            >
                              ✓ Complete
                            </button>
                            <button
                              className="btn-edit"
                              title="Edit prescription"
                              onClick={() => handleEditPrescription(p)}
                            >
                              ✏ Edit
                            </button>
                            <button
                              className="btn-cancel"
                              title="Cancel prescription"
                              onClick={() => handleUpdatePrescriptionStatus(p._id, "CANCELLED")}
                            >
                              ✕ Cancel
                            </button>
                          </>
                        )}

                        {p.status !== "ACTIVE" && (
                          <>
                            <button
                              className="btn-reactivate"
                              title="Reactivate prescription"
                              onClick={() => handleUpdatePrescriptionStatus(p._id, "ACTIVE")}
                            >
                              ↺ Reactivate
                            </button>
                            <button
                              className="btn-delete"
                              title="Permanently remove prescription"
                              onClick={() => handleDeletePrescription(p._id)}
                            >
                              🗑 Delete
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    {p.instructions && (
                      <div className="prescription-instructions">
                        <span className="inst-label">Instructions:</span> {p.instructions}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </section>

        </main>

      </div>
    );
  }


  // =====================================================
  // MAIN DASHBOARD
  // =====================================================

  return (
    <div className="app">

      {/* HEADER */}

      <header className="header">

        <div>

          <h1>
            LifeGuard AI
          </h1>

          <p>
            Patient Care Intelligence
          </p>

        </div>


                <button className="logout-button" onClick={handleLogout}>
          Logout
        </button>




        <div className="status">

          <span className="status-dot"></span>

          System Connected

        </div>


        <nav className="navbar">

          <button
            className={
              activePage === "dashboard"
                ? "nav-active"
                : ""
            }
            onClick={() =>
              goToPage("dashboard")
            }
          >
            Dashboard
          </button>


          <button
            className={
              activePage === "patients"
                ? "nav-active"
                : ""
            }
            onClick={() =>
              goToPage("patients")
            }
          >
            Patients
          </button>


          <button
            className={
              activePage === "alerts"
                ? "nav-active"
                : ""
            }
            onClick={() =>
              goToPage("alerts")
            }
          >
            Alerts
          </button>


          <button
            className={
              activePage === "rooms"
                ? "nav-active"
                : ""
            }
            onClick={() =>
              goToPage("rooms")
            }
          >
            Rooms
          </button>

          <button
            className={
              activePage === "beds"
                ? "nav-active"
                : ""
            }
            onClick={() =>
              goToPage("beds")
            }
          >
            Beds
          </button>

        </nav>

      </header>


      <main>

        {loading && (
          <p className="message">
            Loading patient data...
          </p>
        )}


        {error && (
          <p className="error">
            {error}
          </p>
        )}


        {!loading && (
          <>

            {/* =================================================
                DASHBOARD
            ================================================= */}

            {activePage === "dashboard" && (
              <>

                <section className="welcome-card">

                  <div>

                    <h2>
                      {new Date().getHours() < 12
                        ? "Good morning, Doctor"
                        : new Date().getHours() < 17
                        ? "Good afternoon, Doctor"
                        : "Good evening, Doctor"}
                    </h2>

                    <p>
                      Here is the latest overview
                      of your patients.
                    </p>

                  </div>

                  <div className="heart">
                    ♥
                  </div>

                </section>


                {/* STATS */}

                <section className="stats">

                  <div className="stat-card">

                    <span className="stat-icon">
                      👥
                    </span>

                    <h2>
                      {patients.length}
                    </h2>

                    <p>
                      Patients
                    </p>

                  </div>


                  <div className="stat-card">

                    <span className="stat-icon">
                      ✓
                    </span>

                    <h2>

                      {
                        patients.filter(
                          (patient) =>
                            patient.risk ===
                            "LOW"
                        ).length
                      }

                    </h2>

                    <p>
                      Low Risk
                    </p>

                  </div>


                  <div className="stat-card">

                    <span className="stat-icon">
                      ⚠
                    </span>

                    <h2>
                      {highRiskPatients.length}
                    </h2>

                    <p>
                      High Risk
                    </p>

                  </div>

                </section>


                {/* ACTIVE ALERTS */}

                <section className="alerts-section">

                  <div className="alerts-header">

                    <h2>
                      🚨 Active Alerts
                    </h2>

                    <span>
                      {alerts.length} Active
                    </span>

                  </div>


                  {alerts.length === 0 ? (

                    <div className="no-alerts">

                      ✓ No active alerts currently
                      detected

                    </div>

                  ) : (

                    <div className="alerts-grid">

                      {alerts.map(
                        (alert) => (

                          <AlertCard
                            key={alert._id}
                            alert={alert}
                          />

                        )
                      )}

                    </div>

                  )}

                </section>


                {/* PATIENT MONITORING */}

                <section className="section-header">

                  <h2>
                    Patient Monitoring
                  </h2>

                  <span>
                    Live Data • Updates every
                    5 sec
                  </span>

                </section>


                <section className="patients-grid">

                  {patients.map(
                    (patient) => (

                      <PatientCard
                        key={patient.patientId}
                        patient={patient}
                      />

                    )
                  )}

                </section>

              </>
            )}


            {/* =================================================
                PATIENTS PAGE
            ================================================= */}

            {activePage === "patients" && (
              <>

                <div className="section-header">

                  <div>

                    <h2>
                      All Patients
                    </h2>

                    <p>
                      View and monitor all
                      registered patients.
                    </p>

                  </div>

                  <span>
                    {patients.length} Patients
                  </span>

                </div>


                <section className="patients-grid">

                  {patients.map(
                    (patient) => (

                      <PatientCard
                        key={patient.patientId}
                        patient={patient}
                      />

                    )
                  )}

                </section>

              </>
            )}


            {/* =================================================
                ALERTS PAGE
            ================================================= */}

            {activePage === "alerts" && (
              <>

                <div className="section-header">

                  <div>

                    <h2>
                      Patient Alerts
                    </h2>

                    <p>
                      Patients requiring immediate
                      or closer attention.
                    </p>

                  </div>


                  <span>
                    {alerts.length} Active
                  </span>

                </div>


                {alerts.length === 0 ? (

                  <div className="no-alerts">

                    ✓ No active alerts currently
                    detected

                  </div>

                ) : (

                  <section className="alerts-grid">

                    {alerts.map(
                      (alert) => (

                        <AlertCard
                          key={alert._id}
                          alert={alert}
                        />

                      )
                    )}

                  </section>

                )}

              </>
            )}


            {/* =================================================
                ROOMS PAGE
            ================================================= */}

            {activePage === "beds" && (
              <>
                <div className="section-header">
                  <div>
                    <h2>Bed Availability</h2>
                    <p>Monitor bed occupancy and assign patients to available beds.</p>
                  </div>
                  <span>{beds.length} Total Beds</span>
                </div>

                {prescriptionMessage && (
                  <div className="prescription-banner banner-success">{prescriptionMessage}</div>
                )}

                <section className="stats" style={{ marginTop: 10 }}>
                  <div className="stat-card">
                    <span className="stat-icon">🏥</span>
                    <h2>{beds.length}</h2>
                    <p>Total Beds</p>
                  </div>
                  <div className="stat-card">
                    <span className="stat-icon">✅</span>
                    <h2>{beds.filter((bed) => bed.status === "AVAILABLE").length}</h2>
                    <p>Available</p>
                  </div>
                  <div className="stat-card">
                    <span className="stat-icon">🛏️</span>
                    <h2>{beds.filter((bed) => bed.status === "OCCUPIED").length}</h2>
                    <p>Occupied</p>
                  </div>
                  <div className="stat-card">
                    <span className="stat-icon">🛠️</span>
                    <h2>{beds.filter((bed) => bed.status === "MAINTENANCE").length}</h2>
                    <p>Maintenance</p>
                  </div>
                </section>

                {assignmentBed && (
                  <div className="prescription-form" style={{ marginTop: 20 }}>
                    <div className="form-header">
                      <h4>Assign Patient to {assignmentBed.bedId}</h4>
                    </div>
                    <div className="form-grid">
                      <div className="form-group full-width">
                        <label>Select Patient</label>
                        <select value={assignmentPatientId} onChange={(e) => setAssignmentPatientId(e.target.value)}>
                          <option value="">Select a patient</option>
                          {patients.map((patient) => (
                            <option key={patient.patientId} value={patient.patientId}>
                              {patient.patientId} - {patient.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div className="form-actions">
                      <button
                        type="button"
                        className="save-btn"
                        onClick={() => assignmentPatientId && assignBed(assignmentBed.bedId, assignmentPatientId)}
                      >
                        Assign Bed
                      </button>
                      <button
                        type="button"
                        className="cancel-btn"
                        onClick={() => {
                          setAssignmentBed(null);
                          setAssignmentPatientId("");
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                <section className="rooms-grid" style={{ marginTop: 20 }}>
                  {beds.map((bed) => (
                    <div className="room-card" key={bed.bedId}>
                      <div className="room-header">
                        <div>
                          <h2>{bed.bedId}</h2>
                          <p>{bed.ward} • Room {bed.room}</p>
                        </div>
                        <span className="room-icon">🛏️</span>
                      </div>

                      <div className="room-environment">
                        <div>Bed No. {bed.bedNumber}</div>
                        <div>Status: {bed.status}</div>
                      </div>

                      {bed.status === "AVAILABLE" && (
                        <div className="prescription-card-actions" style={{ marginTop: 15 }}>
                          <button className="btn-complete" onClick={() => {
                            setAssignmentBed(bed);
                            setAssignmentPatientId("");
                          }}>
                            Assign Patient
                          </button>
                        </div>
                      )}

                      {bed.status === "OCCUPIED" && (
                        <div className="room-patients" style={{ marginTop: 10 }}>
                          <div className="room-patient">
                            <div className="patient-info">
                              <div className="patient-number">{bed.patientId?.replace("P", "") || "--"}</div>
                              <div>
                                <h3>{bed.patientName || "Assigned patient"}</h3>
                                <p>{bed.patientId || "No patient ID"}</p>
                              </div>
                            </div>
                          </div>
                          <div className="prescription-card-actions" style={{ marginTop: 12 }}>
                            <button className="btn-cancel" onClick={() => releaseBed(bed.bedId)}>Release Bed</button>
                          </div>
                        </div>
                      )}

                      {bed.status === "MAINTENANCE" && (
                        <div className="prescription-card-actions" style={{ marginTop: 15 }}>
                          <button className="btn-reactivate" onClick={() => setBedAvailable(bed.bedId)}>Set Available</button>
                        </div>
                      )}

                      <div className="prescription-card-actions" style={{ marginTop: 10, justifyContent: "flex-end" }}>
                        {bed.status !== "MAINTENANCE" && (
                          <button className="btn-cancel" onClick={() => setBedMaintenance(bed.bedId)}>Maintenance</button>
                        )}
                        <button className="btn-delete" onClick={() => deleteBed(bed.bedId)}>Delete</button>
                      </div>
                    </div>
                  ))}
                </section>
              </>
            )}

            {activePage === "rooms" && (
              <>

                <div className="section-header">

                  <div>

                    <h2>
                      Room Monitoring
                    </h2>

                    <p>
                      Monitor environmental
                      conditions and patients
                      by room.
                    </p>

                  </div>


                  <span>
                    {rooms.length} Rooms
                  </span>

                </div>


                <section className="rooms-grid">

                  {rooms.map((room) => {

                    const roomPatients =
                      patients.filter(
                        (patient) =>
                          patient.room ===
                          room.roomId
                      );


                    return (

                      <div
                        className="room-card"
                        key={room.roomId}
                      >

                        {/* ROOM HEADER */}

                        <div className="room-header">

                          <div>

                            <h2>
                              Room {room.roomId}
                            </h2>

                            <p>
                              {
                                roomPatients.length
                              } Patient
                              {roomPatients.length !==
                              1
                                ? "s"
                                : ""}
                            </p>

                          </div>


                          <span className="room-icon">
                            🏥
                          </span>

                        </div>


                        {/* ROOM ENVIRONMENT */}

                        <div className="room-environment">

                          <div>
                            🌡️{" "}
                            {room.temperature ??
                              "--"}°C
                          </div>

                          <div>
                            💧{" "}
                            {room.humidity ??
                              "--"}%
                          </div>

                          <div>
                            🌬️ AQ{" "}
                            {room.airQuality ??
                              "--"}
                          </div>

                          <div>
                            👤{" "}
                            {room.presenceDetected
                              ? "Present"
                              : "No Presence"}
                          </div>

                        </div>


                        {/* ROOM PATIENTS */}

                        <div className="room-patients">

                          {roomPatients.length ===
                          0 ? (

                            <p>
                              No patients assigned
                              to this room.
                            </p>

                          ) : (

                            roomPatients.map(
                              (patient) => (

                                <div
                                  className="room-patient"
                                  key={
                                    patient.patientId
                                  }
                                  onClick={() =>
                                    fetchPatientDetails(
                                      patient.patientId
                                    )
                                  }
                                >

                                  <div className="patient-info">

                                    <div className="patient-number">

                                      {patient.patientId.replace(
                                        "P",
                                        ""
                                      )}

                                    </div>


                                    <div>

                                      <h3>
                                        {patient.name}
                                      </h3>

                                      <p>
                                        {
                                          patient.patientId
                                        }
                                      </p>

                                    </div>

                                  </div>


                                  <span
                                    className={`risk ${getRiskClass(
                                      patient.risk
                                    )}`}
                                  >
                                    {
                                      patient.risk
                                    }
                                  </span>

                                </div>

                              )
                            )

                          )}

                        </div>

                      </div>

                    );

                  })}

                </section>

              </>
            )}

          </>
        )}

      </main>

    </div>
  );
}

function LoginScreen({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");

  const submitLogin = (event) => {
    event.preventDefault();

    const success = onLogin(username.trim(), password);

    if (!success) {
      setLoginError("Invalid username or password");
      return;
    }

    setLoginError("");
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-brand">
          <div className="login-heart">♥</div>
          <h1>LifeGuard AI</h1>
          <p>Patient Care Intelligence</p>
        </div>

        <form onSubmit={submitLogin} className="login-form">
          <h2>Sign In</h2>
          <p className="login-subtitle">
            Sign in to access the patient monitoring dashboard.
          </p>

          <label htmlFor="login-username">Username</label>
          <input
            id="login-username"
            type="text"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            placeholder="Enter username"
            autoComplete="username"
          />

          <label htmlFor="login-password">Password</label>
          <input
            id="login-password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Enter password"
            autoComplete="current-password"
          />

          {loginError && <div className="login-error">{loginError}</div>}

          <button type="submit" className="login-button">
            Login
          </button>

          <p className="login-demo">
            Demo login: <strong>admin</strong> / <strong>admin123</strong>
          </p>
        </form>
      </div>
    </div>
  );
}

export default App;
