from database import SessionLocal
from models import Patient

db = SessionLocal()

patients = [
    Patient(
        id="P003",
        room="102",
        heart_rate=108,
        spo2=92,
        temperature=38.2,
        risk="HIGH"
    ),
    Patient(
        id="P012",
        room="105",
        heart_rate=96,
        spo2=95,
        temperature=37.6,
        risk="MODERATE"
    ),
    Patient(
        id="P007",
        room="103",
        heart_rate=78,
        spo2=98,
        temperature=36.8,
        risk="LOW"
    ),
    Patient(
        id="P015",
        room="107",
        heart_rate=82,
        spo2=97,
        temperature=37.0,
        risk="LOW"
    )
]

db.add_all(patients)
db.commit()
db.close()

print("Patients added successfully!")