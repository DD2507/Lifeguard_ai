from fastapi import FastAPI, Depends
from sqlalchemy.orm import Session

from database import engine, SessionLocal, Base
from models import Patient


# ============================================================
# DATABASE
# ============================================================

Base.metadata.create_all(bind=engine)


# ============================================================
# APP
# ============================================================

app = FastAPI(title="LifeGuard AI API")


# ============================================================
# DATABASE SESSION
# ============================================================

def get_db():
    db = SessionLocal()

    try:
        yield db
    finally:
        db.close()


# ============================================================
# HELPER FUNCTIONS
# ============================================================

def patient_to_dict(patient):
    """
    Convert database Patient object into the format
    expected by the Flutter application.
    """

    patient_id = str(patient.id)

    return {
        "patientId": patient_id,
        "name": f"Patient {patient_id.replace('P', '')}",
        "room": patient.room,
        "heartRate": patient.heart_rate,
        "spo2": patient.spo2,
        "temperature": patient.temperature,
        "risk": patient.risk,
    }


def calculate_risk_reasons(patient):
    """
    Generate the contributing factors shown
    on the Patient Details screen.
    """

    reasons = []

    heart_rate = patient.heart_rate
    spo2 = patient.spo2
    temperature = patient.temperature

    # Heart Rate
    if heart_rate is not None and (heart_rate > 100 or heart_rate < 60):
        reasons.append({
            "factor": "Heart Rate",
            "severity": "MODERATE",
            "value": heart_rate,
            "explanation": (
                f"Heart rate of {heart_rate} BPM is outside "
                "the normal monitoring range and contributes "
                "to the risk assessment."
            ),
        })

    # SpO2
    if spo2 is not None and spo2 < 95:
        reasons.append({
            "factor": "SpO₂",
            "severity": "MODERATE",
            "value": spo2,
            "explanation": (
                f"SpO₂ of {spo2}% is below the configured "
                "monitoring threshold and contributes "
                "to the risk assessment."
            ),
        })

    # Body temperature
    if temperature is not None and temperature >= 38:
        reasons.append({
            "factor": "Body Temperature",
            "severity": "MODERATE",
            "value": temperature,
            "explanation": (
                f"Temperature of {temperature}°C is elevated "
                "and contributes to the risk assessment."
            ),
        })

    return reasons


def get_risk_score(patient):
    """
    Generate a simple risk score for the current prototype.
    """

    score = 0.0

    heart_rate = patient.heart_rate
    spo2 = patient.spo2
    temperature = patient.temperature

    if heart_rate is not None:
        if heart_rate > 100 or heart_rate < 60:
            score += 0.3

    if spo2 is not None:
        if spo2 < 95:
            score += 0.3

    if temperature is not None:
        if temperature >= 38:
            score += 0.3

    # Keep score between 0 and 1
    return round(min(score, 1.0), 1)


def get_room_context(patient):
    """
    Room/environment information.

    These values are currently prototype values because
    the Patient model shown in your backend contains
    patient vitals and room number, but no room sensor
    columns.
    """

    return {
        "temperature": 32,
        "humidity": 78,
        "airQuality": 220,
        "presenceDetected": True,
    }


def get_recommended_action(patient):
    """
    Generate room action recommendations.
    """

    room = get_room_context(patient)

    fan = room["temperature"] >= 30

    risk = str(patient.risk).upper()

    buzzer = (
        risk == "CRITICAL"
        or risk == "HIGH"
        or (
            patient.spo2 is not None
            and patient.spo2 < 93
        )
    )

    if fan and buzzer:
        reason = (
            "Fan activation is recommended because room "
            "temperature is elevated. Buzzer activation is "
            "recommended because the patient requires closer attention."
        )

    elif fan:
        reason = (
            "Fan activation is recommended because the "
            "room temperature is elevated."
        )

    elif buzzer:
        reason = (
            "Buzzer activation is recommended because "
            "the patient requires immediate attention."
        )

    else:
        reason = (
            "No immediate room intervention is required."
        )

    return {
        "fan": fan,
        "buzzer": buzzer,
        "reason": reason,
    }


# ============================================================
# ROOT
# ============================================================

@app.get("/")
def root():
    return {
        "message": "LifeGuard AI Backend is running"
    }


# ============================================================
# PATIENTS
# ============================================================

@app.get("/api/patients")
def get_patients(db: Session = Depends(get_db)):

    patients = db.query(Patient).all()

    return [
        patient_to_dict(patient)
        for patient in patients
    ]


# ============================================================
# SINGLE PATIENT
# ============================================================

@app.get("/api/patients/{patient_id}")
def get_patient(
    patient_id: str,
    db: Session = Depends(get_db)
):

    patient = (
        db.query(Patient)
        .filter(Patient.id == patient_id)
        .first()
    )

    if patient is None:
        return {
            "error": "Patient not found"
        }

    result = patient_to_dict(patient)

    reasons = calculate_risk_reasons(patient)
    room = get_room_context(patient)
    action = get_recommended_action(patient)

    result["riskScore"] = get_risk_score(patient)
    result["riskSummary"] = (
        f"{patient.risk} risk is associated with "
        f"{len(reasons)} contributing factor(s)."
        if reasons
        else "No significant risk factors detected."
    )

    result["riskReasons"] = reasons
    result["roomContext"] = room
    result["recommendedAction"] = action

    return result


# ============================================================
# ALERTS
# ============================================================

@app.get("/api/alerts")
def get_alerts(db: Session = Depends(get_db)):

    patients = db.query(Patient).all()

    alerts = []

    for patient in patients:

        risk = str(patient.risk).upper()

        if risk not in ["HIGH", "CRITICAL"]:
            continue

        reasons = calculate_risk_reasons(patient)

        alerts.append({
            "patientId": str(patient.id),
            "patientName": f"Patient {str(patient.id).replace('P', '')}",
            "room": patient.room,
            "risk": risk,
            "summary": (
                f"{risk} risk is associated with the following "
                "contributing factors: "
                + ", ".join(
                    reason["factor"]
                    for reason in reasons
                )
                + "."
            ),
            "riskScore": get_risk_score(patient),
        })

    return alerts


# ============================================================
# ROOMS
# ============================================================

@app.get("/api/rooms")
def get_rooms(db: Session = Depends(get_db)):

    patients = db.query(Patient).all()

    rooms = []

    seen_rooms = set()

    for patient in patients:

        room_number = patient.room

        if room_number in seen_rooms:
            continue

        seen_rooms.add(room_number)

        room_context = get_room_context(patient)

        rooms.append({
            "room": room_number,
            "name": f"Room {room_number}",
            "patientDetected": True,
            "patientId": str(patient.id),
            "temperature": room_context["temperature"],
            "humidity": room_context["humidity"],
            "airQuality": room_context["airQuality"],
            "connected": True,
        })

    return rooms


# ============================================================
# VITAL HISTORY
# ============================================================

@app.get("/api/vitals/{patient_id}/history")
def get_vital_history(
    patient_id: str,
    db: Session = Depends(get_db)
):

    patient = (
        db.query(Patient)
        .filter(Patient.id == patient_id)
        .first()
    )

    if patient is None:
        return {
            "error": "Patient not found"
        }

    # Prototype history.
    # Later this can be replaced with actual historical
    # readings from the database.

    return [
        {
            "heartRate": patient.heart_rate,
            "spo2": patient.spo2,
            "temperature": patient.temperature,
        }
    ]
# ============================================================
# ROOM CONTROL
# ============================================================

@app.post("/api/rooms/{room_id}/control")
def control_room(
    room_id: int,
    data: dict
):
    fan = data.get("fan", False)
    buzzer = data.get("buzzer", False)

    return {
        "success": True,
        "room": room_id,
        "fan": fan,
        "buzzer": buzzer,
        "message": "Room control updated successfully"
    }