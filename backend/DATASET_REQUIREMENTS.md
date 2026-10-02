# LifeGuard AI Dataset Requirements

## Prediction target

The current output is a prototype adult resting-vital **screening level**:
`LOW`, `MODERATE`, or `HIGH`. It is not a diagnosis and it does not currently
predict a defined clinical outcome such as sepsis, ICU transfer, cardiac arrest,
or mortality.

An accuracy claim is meaningful only after fixing the target, prediction time,
population, and reference label. A future clinical-outcome model must be trained
against observed outcomes, not labels generated from the same thresholds that
the model is expected to reproduce.

## Current dataset

### MIMIC-IV-ED Demo v2.2

- Purpose: real deidentified adult emergency-department vital-sign values.
- Used fields: `heartrate`, `o2sat`, `temperature`, `subject_id`.
- Documentation: https://mimic.mit.edu/docs/iv/modules/ed/vitalsign.html
- Dataset and license: https://physionet.org/content/mimic-iv-ed-demo/2.2/
- DOI: https://doi.org/10.13026/jzz5-vs76
- Important limitation: only 100 patients from one hospital are in the demo.
- Important unit rule: temperature is normally Fahrenheit, but documentation
  warns that some Celsius values may occur. The training code handles both.
- Important missingness rule: values can be absent because they were not
  recorded or because free text was removed during deidentification.

This dataset supports a reproducible demonstration that uses real physiological
measurements. It is not large or representative enough to establish clinical
accuracy.

## Additional data required

### Shared synthetic dataset

The externally supplied `patient_vitals_100000.csv` has been reviewed in
`FRIEND_DATASET_REVIEW.md`. It contains 100,000 complete synthetic rows and can
support stress testing, but it must remain separate from real clinical training
and validation metrics. Its disease-like `Condition` labels are not verified
clinical outcomes and are not interchangeable with LifeGuard risk levels.

### 1. External physiological validation

Use VitalDB as an external dataset for heart rate, SpO2, and temperature time
series. It contains 6,388 surgical cases and high-resolution monitor data.

- Dataset: https://physionet.org/content/vitaldb/1.0.0/
- DOI: https://doi.org/10.13026/czw8-9p62
- Size: approximately 95 GB uncompressed.
- Limitation: surgical/anesthesia patients differ from resting ward patients.

VitalDB should initially be used as a locked external test dataset, not mixed
into training. This measures whether the model generalizes to another site and
care setting.

### 2. Outcome-labelled data

To claim prediction of deterioration or disease, collect or license data with:

- an explicit clinical endpoint and timestamp;
- a defined prediction horizon;
- clinician-reviewed or otherwise defensible reference labels;
- enough positive examples for sensitivity estimates;
- age, sex, comorbidity, medication, activity, and care-setting context;
- patient-level separation across training, validation, and test sets.

The PhysioNet/Computing in Cardiology 2019 challenge is one possible source for
a **sepsis-specific** model because it includes time-series heart rate, oxygen
saturation, temperature, and a sepsis outcome. It must not be used to claim a
general-purpose risk predictor.

- Documentation: https://physionet.org/content/challenge-2019/1.0.0/

### 3. Local device validation data

Collect paired readings from the exact ESP32, pulse-oximeter, temperature, and
room sensors used in the demonstration. Each device reading should be paired
with a suitable reference device and include timestamp, placement, motion,
signal quality, and failure status. Split evaluation by person/device session,
not individual packet, to avoid leakage.

Pulse oximeters are affected by motion, circulation, skin pigmentation, skin
temperature, tobacco use, and nail polish. These conditions need representation
in the device-validation set.

### 4. Environmental sensor calibration

Raw MQ135 ADC values are not AQI and cannot be trained as universal air-quality
measurements. Required local data are simultaneous raw ADC, sensor warm-up and
age, temperature/humidity, and calibrated reference concentrations for the
specific gas or particulate target. Until calibration is completed, the UI and
model must call the feature a **raw MQ135 reading**, not AQI.

Room temperature and humidity should likewise be compared with calibrated
reference instruments. Environmental data should affect room-response guidance,
not be presented as proof of a patient diagnosis.

## Evaluation requirements

Before making an accuracy claim, report all of the following on a locked,
patient-independent external test set:

- confusion matrix for LOW/MODERATE/HIGH;
- per-class sensitivity/recall, specificity, precision, and F1;
- macro-averaged metrics, not accuracy alone;
- calibration and Brier score for probabilities;
- 95% confidence intervals;
- results by age group, sex, skin-pigmentation proxy where ethically and
  appropriately available, device, site, and signal-quality group;
- missing-data and sensor-failure performance;
- false-negative review for HIGH cases;
- comparison against the deterministic rules and a simple baseline model.

The current held-out MIMIC demo result must be described as internal prototype
evaluation. Its overall accuracy does not establish clinical performance.

## Release gate

Do not describe the system as clinically accurate or medically validated until:

1. The intended population and clinical outcome are fixed.
2. The model is trained on representative, outcome-labelled data.
3. A separate external dataset meets pre-specified sensitivity and calibration
   targets, particularly for HIGH risk.
4. Local sensors pass paired reference-device validation.
5. Failure modes, subgroup results, and intended-use limitations are reviewed
   with qualified clinical and regulatory experts.

These requirements follow FDA Good Machine Learning Practice principles:
https://www.fda.gov/medical-devices/artificial-intelligence-enabled-medical-devices/good-machine-learning-practice-medical-device-development-guiding-principles
