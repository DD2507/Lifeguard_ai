"""Train the LifeGuard prototype model from reproducible public data.

Physiological measurements come from the deidentified MIMIC-IV-ED demo.
Risk labels are screening labels derived from cited reference ranges, not
diagnoses or outcomes recorded in MIMIC. Room features are simulated because
MIMIC-IV-ED does not include the project's room sensors.
"""

import hashlib
import json
import os
import urllib.request
from datetime import datetime, timezone

import joblib
import numpy as np
import pandas as pd
import shap
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score, classification_report
from sklearn.model_selection import GroupShuffleSplit


RANDOM_SEED = 42
SOURCE_URL = "https://physionet.org/files/mimic-iv-ed-demo/2.2/ed/vitalsign.csv.gz"
SOURCE_SHA256 = "89967d8b9dd139d540e9d08270bb6282dd2df0eb7111d38bfe2a79c0b291ab78"
ROOT = os.path.dirname(os.path.abspath(__file__))
DATA_PATH = os.path.join(ROOT, "data", "mimic-iv-ed-demo-2.2-vitalsign.csv.gz")
ARTIFACT_DIR = os.path.join(ROOT, "models")

FEATURES = [
    "heartRate", "spo2", "temperature", "roomTemperature", "humidity",
    "airQuality", "hrDeviation", "spo2Deviation", "tempDeviation"
]


def download_source():
    os.makedirs(os.path.dirname(DATA_PATH), exist_ok=True)
    if not os.path.exists(DATA_PATH):
        print(f"Downloading public training source: {SOURCE_URL}")
        urllib.request.urlretrieve(SOURCE_URL, DATA_PATH)
    with open(DATA_PATH, "rb") as source:
        digest = hashlib.sha256(source.read()).hexdigest()
    if digest != SOURCE_SHA256:
        raise RuntimeError(f"Dataset checksum mismatch: expected {SOURCE_SHA256}, got {digest}")


def temperature_to_celsius(value):
    value = float(value)
    return (value - 32) * 5 / 9 if value > 45 else value


def clinical_severity(row):
    """Evidence-aligned adult resting screening severity, not a diagnosis."""
    hr, spo2, temp = row["heartRate"], row["spo2"], row["temperature"]
    if hr < 50 or hr > 120 or spo2 < 90 or temp < 32 or temp >= 39:
        return 2
    if hr < 60 or hr > 100 or spo2 < 95 or temp < 34 or temp >= 38:
        return 1
    return 0


def build_training_data():
    raw = pd.read_csv(DATA_PATH, compression="gzip")
    raw = raw[["subject_id", "heartrate", "o2sat", "temperature"]].dropna().copy()
    raw.columns = ["subject_id", "heartRate", "spo2", "temperature"]
    raw["temperature"] = raw["temperature"].map(temperature_to_celsius)
    raw = raw[
        raw["heartRate"].between(30, 220)
        & raw["spo2"].between(70, 100)
        & raw["temperature"].between(25, 45)
    ].copy()

    baseline = raw.groupby("subject_id")[["heartRate", "spo2", "temperature"]].median()
    raw = raw.join(baseline, on="subject_id", rsuffix="Baseline")
    raw["hrDeviation"] = raw["heartRate"] - raw["heartRateBaseline"]
    raw["spo2Deviation"] = raw["spo2"] - raw["spo2Baseline"]
    raw["tempDeviation"] = raw["temperature"] - raw["temperatureBaseline"]

    # Apply deterministic room contexts to real vital-sign observations.
    # These sensor inputs are simulated and are not represented as clinical data.
    rng = np.random.default_rng(RANDOM_SEED)
    frame = raw.loc[raw.index.repeat(4)].reset_index(drop=True)
    frame["roomTemperature"] = rng.uniform(18, 35, len(frame))
    frame["humidity"] = rng.uniform(30, 85, len(frame))
    frame["airQuality"] = rng.uniform(50, 300, len(frame))

    severity = frame.apply(clinical_severity, axis=1).to_numpy()
    environmental_flags = (
        ((frame["roomTemperature"] < 22) | (frame["roomTemperature"] > 28)).astype(int)
        + (frame["humidity"] > 70).astype(int)
        + (frame["airQuality"] > 200).astype(int)
    )
    severity = np.maximum(severity, (environmental_flags >= 2).astype(int))
    frame["risk"] = np.array(["LOW", "MODERATE", "HIGH"])[severity]
    return frame


def main():
    download_source()
    frame = build_training_data()
    splitter = GroupShuffleSplit(n_splits=1, test_size=0.2, random_state=RANDOM_SEED)
    train_idx, test_idx = next(splitter.split(frame, groups=frame["subject_id"]))
    train, test = frame.iloc[train_idx], frame.iloc[test_idx]

    model = RandomForestClassifier(
        n_estimators=300,
        max_depth=10,
        min_samples_leaf=3,
        class_weight="balanced",
        random_state=RANDOM_SEED,
        n_jobs=-1,
    )
    model.fit(train[FEATURES], train["risk"])
    predictions = model.predict(test[FEATURES])
    report = classification_report(test["risk"], predictions, output_dict=True, zero_division=0)

    os.makedirs(ARTIFACT_DIR, exist_ok=True)
    joblib.dump(model, os.path.join(ARTIFACT_DIR, "random_forest_model.joblib"))
    joblib.dump(shap.TreeExplainer(model), os.path.join(ARTIFACT_DIR, "shap_explainer.joblib"))
    metadata = {
        "modelType": "RandomForestClassifier",
        "trainedAt": datetime.now(timezone.utc).isoformat(),
        "source": {
            "name": "MIMIC-IV-ED Demo v2.2 vitalsign",
            "url": SOURCE_URL,
            "doi": "10.13026/jzz5-vs76",
            "sha256": SOURCE_SHA256,
            "license": "Open Data Commons Open Database License v1.0",
        },
        "realClinicalRows": int(frame.shape[0] / 4),
        "trainingRowsAfterRoomAugmentation": int(len(train)),
        "testRowsAfterRoomAugmentation": int(len(test)),
        "patientGroupedSplit": True,
        "features": FEATURES,
        "accuracy": accuracy_score(test["risk"], predictions),
        "classificationReport": report,
        "labelMethod": "Evidence-aligned adult resting screening thresholds; labels are not diagnoses or observed outcomes.",
        "limitations": [
            "Room temperature, humidity, and raw MQ135 values are simulated because MIMIC-IV-ED does not contain these sensors.",
            "The open demo contains only 100 deidentified patients and is not representative enough for clinical use.",
            "This prototype has not been prospectively or externally clinically validated.",
        ],
    }
    with open(os.path.join(ARTIFACT_DIR, "model_metadata.json"), "w", encoding="utf-8") as output:
        json.dump(metadata, output, indent=2)

    print(f"Accuracy: {metadata['accuracy']:.3f}")
    print(classification_report(test["risk"], predictions, zero_division=0))
    print(f"Saved model, SHAP explainer, and metadata to {ARTIFACT_DIR}")


if __name__ == "__main__":
    main()
