import { useEffect, useState } from "react";
import "./App.css";

const API_BASE = "http://localhost:5000/api";

function App() {
  const [patients, setPatients] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [rooms, setRooms] = useState([]);

  const [activePage, setActivePage] = useState("dashboard");
  const [selectedPatient, setSelectedPatient] = useState(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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
    } catch (err) {
      console.error(err);

      setError(
        "Unable to load patient details"
      );
    }
  };


  // =====================================================
  // INITIAL DATA + LIVE POLLING
  // =====================================================

  useEffect(() => {
    fetchPatients();
    fetchAlerts();
    fetchRooms();

    const interval = setInterval(() => {
      fetchPatients();
      fetchAlerts();
      fetchRooms();
    }, 5000);

    return () => clearInterval(interval);
  }, []);


  // =====================================================
  // LIVE PATIENT DETAILS
  // =====================================================

  useEffect(() => {
    if (!selectedPatient) {
      return;
    }

    const interval = setInterval(() => {
      fetchPatientDetails(
        selectedPatient.patientId
      );
    }, 5000);

    return () => clearInterval(interval);
  }, [selectedPatient]);


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
            Why This Risk Was Assigned
          </h2>


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

                      <span>
                        {reason.severity}
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
                AI Explanation
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
                      Good evening, Doctor
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

export default App;