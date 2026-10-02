# Review of patient_vitals_100000.csv

## Decision

Do **not** mix this file into the model's real-clinical-data training set. Every
row is explicitly marked `SIMULATED`, and the file provides no generator,
source citation, clinical collection protocol, label definition, or license.

The file can be used as synthetic stress-test input after preserving its hash
and recording who created it and how it was generated. It cannot support a
claim that LifeGuard was trained or validated on real patients.

## File identity

- Rows: 100,000
- Columns: 11
- SHA-256: `b9c2cd090af8061c80da8a8ca5d3ed505ff575fbf149999cf60009399858197b`
- Missing cells: 0
- Exact duplicate rows: 0
- `Data_Type`: `SIMULATED` for 100% of rows
- Patient IDs: 100,000 unique values

The original file remains external to the repository. Its hash should be used
to confirm that a later copy is the same dataset.

## Available fields

The file contains age, sex, heart rate, body temperature, SpO2, systolic and
diastolic blood pressure, respiratory rate, a condition label, and data type.

Only heart rate, body temperature, and SpO2 match current LifeGuard model
inputs. LifeGuard does not currently receive age, sex, blood pressure, or
respiratory rate from its patient sensor payload. Training on those extra
features would create training-serving skew unless the application and hardware
are deliberately extended to collect and validate them.

The dataset has no room temperature, humidity, raw MQ135 value, timestamp,
signal-quality field, device identifier, repeated patient observations,
personal baseline, treatment, medication, activity state, clinical outcome, or
label timestamp.

## Label review

The ten synthetic `Condition` values and row counts are:

| Condition | Rows |
| --- | ---: |
| Healthy | 24,876 |
| High_BP | 12,071 |
| Heart_Disease | 12,001 |
| Fever_Infection | 10,062 |
| Respiratory_Disease | 10,043 |
| Low_BP | 7,937 |
| Cancer | 7,194 |
| Diabetes | 6,941 |
| Anemia | 4,901 |
| Critical | 3,974 |

These condition names are not equivalent to LifeGuard's LOW/MODERATE/HIGH
screening levels. Several conditions cannot be diagnosed from a single vital-
sign row. For example, cancer, diabetes, anemia, and heart disease require
clinical information not present here. Converting these labels into risk labels
would introduce an unsupported reference standard.

## Quality findings

- 1,111 rows have systolic blood pressure less than or equal to diastolic blood
  pressure and need review before any blood-pressure experiment.
- 383 rows have respiratory rate below 8 breaths/minute.
- 428 rows have respiratory rate above 40 breaths/minute.
- Age has almost zero correlation with every generated vital sign, despite a
  wide 18-90 year range. This is a clue that age was sampled independently.
- Sex is almost exactly balanced within each condition, another likely
  generator design rather than evidence of a collected cohort.
- The condition groups have visibly constructed ranges; for example, the
  `Critical` group has mean heart rate 124.9 and mean SpO2 85.1, while `Healthy`
  has mean heart rate 72.1 and mean SpO2 98.0.

These patterns make the file convenient for software testing but can produce
unrealistically easy machine-learning results.

## Compatibility with the current model

Using only the current physiological training-domain checks:

- 87,002 rows (87.0%) are inside the model's heart-rate, SpO2, and temperature
  ranges.
- 84.5% of `Critical` rows and 42.3% of `Respiratory_Disease` rows are outside
  those ranges, so the production AI client would correctly withhold inference
  for many of the most abnormal synthetic cases.
- With neutral room values and zero personal-baseline deviations, the trained
  model labels 92.9% of in-domain `Healthy` rows LOW and 97.6% of in-domain
  `Critical` rows MODERATE or HIGH. This is a stress-test observation, not a
  clinical accuracy measurement, because the comparison labels are synthetic
  conditions rather than verified risk outcomes.

## Acceptable uses

- API load and performance testing.
- UI demonstrations with an explicit `SIMULATED` badge.
- Boundary and invalid-reading tests.
- Testing future parsers for blood pressure and respiratory rate.
- Exploratory experiments kept separate from reported clinical metrics.

## Information required from the creator

Before using the file for any model-development experiment, obtain:

1. The generator script and random seed.
2. The source ranges or distributions for every condition.
3. The exact rules used to assign `Condition`.
4. Whether dependencies between measurements were explicitly modelled.
5. Intended use and known limitations.
6. License and redistribution permission.
7. Version history and a stable download location.

Without these items, results derived from this file are not reproducible or
auditable.
