# LifeGuard AI Model Card

## Intended use

LifeGuard AI is a university prototype for adult resting-vital monitoring. It
provides a screening risk level and an explanation for demonstration purposes.
It is not a diagnosis, medical device, or substitute for clinical judgment.

## Training data

The physiological training rows come from the openly available, deidentified
MIMIC-IV-ED Demo v2.2 `vitalsign` table (100 patients), maintained by the MIT
Laboratory for Computational Physiology on PhysioNet:

- Dataset: https://physionet.org/content/mimic-iv-ed-demo/2.2/
- DOI: https://doi.org/10.13026/jzz5-vs76
- License: Open Data Commons Open Database License v1.0
- Fields used: heart rate, oxygen saturation, and temperature

`train_model.py` downloads the pinned source file, verifies its SHA-256 hash,
converts Fahrenheit temperatures to Celsius, removes incomplete/out-of-sensor-
range rows, and splits train/test data by patient to reduce leakage.

MIMIC-IV-ED does not contain this project's room temperature, humidity, or raw
MQ135 sensor readings. Those features are explicitly simulated during training
and must not be described as real clinical data. Personal-baseline deviations
are derived from each demo patient's median observations.

## Label basis

The public dataset supplies measurements, not LifeGuard risk labels. Training
labels are therefore screening labels generated from published adult resting
reference ranges:

- Resting heart rate: 60-100 BPM is the general adult reference range; over
  100 BPM is tachycardia in a resting context.
  https://www.heart.org/en/health-topics/arrhythmia/about-arrhythmia/tachycardia--fast-heart-rate
- Pulse oximetry: normal readings are generally 95-100%; values below 90% are
  considered low.
  https://www.fda.gov/media/113104/download
- Body temperature: a common adult normal range is 36.1-37.2 C and 38 C or
  above generally indicates fever.
  https://medlineplus.gov/ency/article/001982.htm
- Indoor humidity: EPA recommends 30-50% and below 60% where possible.
  https://www.epa.gov/indoor-air-quality-iaq/care-your-air-guide-indoor-air-quality

The raw MQ135 value is device-specific and is not an AQI or pollutant
concentration without calibration. Its threshold is prototype-specific.

## Runtime safeguards

The deterministic rule engine remains the authoritative screening floor. The
model may raise the risk classification but cannot lower a risk identified by
the rules. Invalid, stale, missing, or out-of-training-range sensor inputs do
not receive an AI inference. Explanations use SHAP feature attribution.

## Limitations

- The demo sample is small and comes from one emergency department.
- Labels are threshold-derived, not clinician-adjudicated outcomes.
- Environmental inputs are simulated.
- Accuracy on the generated labels is not evidence of clinical accuracy.
- No prospective, external, subgroup-fairness, calibration, or medical-device
  validation has been performed.

The concrete data collection and external-validation work needed to close these
gaps is tracked in `DATASET_REQUIREMENTS.md`.

Accurate demo wording: "The model was trained using deidentified physiological
measurements from the public MIMIC-IV-ED demo. Its prototype screening labels
use published adult resting reference ranges. Environmental fields are
simulated, and the system is not clinically validated."
