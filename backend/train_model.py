import os
import joblib
import numpy as np
import pandas as pd

from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, accuracy_score

np.random.seed(42)

N = 3000

heart_rate = np.random.uniform(55, 125, N)
spo2 = np.random.uniform(88, 100, N)
temperature = np.random.uniform(35.5, 39.5, N)

room_temp = np.random.uniform(18, 35, N)
humidity = np.random.uniform(30, 85, N)
air_quality = np.random.uniform(50, 300, N)

hr_deviation = np.random.uniform(-20, 40, N)
spo2_deviation = np.random.uniform(-10, 3, N)
temp_deviation = np.random.uniform(-1, 2.5, N)

risk_score = (
    (heart_rate > 100) * 0.20 +
    (spo2 < 94) * 0.30 +
    (temperature > 38) * 0.20 +
    (room_temp > 30) * 0.10 +
    (humidity > 75) * 0.05 +
    (air_quality > 200) * 0.05 +
    (hr_deviation > 15) * 0.05 +
    (spo2_deviation < -2) * 0.10 +
    (temp_deviation > 0.8) * 0.10
)

risk_score = np.minimum(risk_score, 1)

risk = np.where(
    risk_score >= 0.60,
    "HIGH",
    np.where(risk_score >= 0.30, "MODERATE", "LOW")
)

df = pd.DataFrame({
    "heartRate": heart_rate,
    "spo2": spo2,
    "temperature": temperature,
    "roomTemperature": room_temp,
    "humidity": humidity,
    "airQuality": air_quality,
    "hrDeviation": hr_deviation,
    "spo2Deviation": spo2_deviation,
    "tempDeviation": temp_deviation,
    "risk": risk
})

features = [
    "heartRate",
    "spo2",
    "temperature",
    "roomTemperature",
    "humidity",
    "airQuality",
    "hrDeviation",
    "spo2Deviation",
    "tempDeviation"
]

X = df[features]
y = df["risk"]

X_train, X_test, y_train, y_test = train_test_split(
    X,
    y,
    test_size=0.2,
    random_state=42,
    stratify=y
)

model = RandomForestClassifier(
    n_estimators=100,
    max_depth=7,
    class_weight="balanced",
    random_state=42
)

model.fit(X_train, y_train)

predictions = model.predict(X_test)

print("Accuracy:", accuracy_score(y_test, predictions))
print()
print(classification_report(y_test, predictions))

os.makedirs("models", exist_ok=True)

joblib.dump(model, "models/random_forest_model.joblib")

print("Model saved to models/random_forest_model.joblib")