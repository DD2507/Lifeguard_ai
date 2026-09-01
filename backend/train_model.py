import os
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report
import joblib
import shap

# Ensure models directory exists
os.makedirs("models", exist_ok=True)

def generate_synthetic_patient_data(num_samples=3000, random_seed=42):
    """
    Generate synthetic clinical dataset based on physiological baseline distributions
    and environmental factors for LifeGuard AI.
    
    Features:
    - heartRate (BPM): 40 - 150
    - spo2 (%): 80 - 100
    - temperature (°C): 35.0 - 41.0
    - roomTemperature (°C): 18.0 - 40.0
    - humidity (%): 30 - 90
    - airQuality (MQ135 index): 50 - 400
    """
    np.random.seed(random_seed)
    
    heart_rate = np.random.normal(loc=78, scale=18, size=num_samples).clip(40, 150)
    spo2 = np.random.normal(loc=97, scale=4, size=num_samples).clip(80, 100)
    temperature = np.random.normal(loc=36.8, scale=1.1, size=num_samples).clip(35.0, 41.0)
    room_temp = np.random.normal(loc=24, scale=5, size=num_samples).clip(18.0, 40.0)
    humidity = np.random.normal(loc=55, scale=12, size=num_samples).clip(30, 90)
    air_quality = np.random.normal(loc=120, scale=60, size=num_samples).clip(50, 400)
    
    data = pd.DataFrame({
        'heartRate': heart_rate,
        'spo2': spo2,
        'temperature': temperature,
        'roomTemperature': room_temp,
        'humidity': humidity,
        'airQuality': air_quality
    })
    
    # Define Target Risk Category based on clinical thresholds & room context
    risks = []
    for _, row in data.iterrows():
        hr, sp, temp, rtemp, hum, aq = row['heartRate'], row['spo2'], row['temperature'], row['roomTemperature'], row['humidity'], row['airQuality']
        
        risk_score = 0
        
        # SpO2 impact (highest clinical weighting)
        if sp < 90:
            risk_score += 0.50
        elif sp < 94:
            risk_score += 0.30
            
        # Heart Rate impact
        if hr < 50 or hr > 120:
            risk_score += 0.35
        elif hr < 60 or hr > 100:
            risk_score += 0.20
            
        # Patient Temp impact
        if temp >= 39.0:
            risk_score += 0.35
        elif temp >= 38.0:
            risk_score += 0.20
            
        # Room environment context impact
        if rtemp > 32.0:
            risk_score += 0.15
        if hum > 75.0:
            risk_score += 0.10
        if aq > 220:
            risk_score += 0.15
            
        if risk_score >= 0.55:
            risks.append('HIGH')
        elif risk_score >= 0.25:
            risks.append('MODERATE')
        else:
            risks.append('LOW')
            
    data['risk'] = risks
    return data

def train_and_export_model():
    print("Generating synthetic patient & environment clinical dataset...")
    df = generate_synthetic_patient_data()
    
    X = df[['heartRate', 'spo2', 'temperature', 'roomTemperature', 'humidity', 'airQuality']]
    y = df['risk']
    
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)
    
    print("Training Random Forest Classifier model...")
    clf = RandomForestClassifier(
        n_estimators=100,
        max_depth=7,
        random_state=42,
        class_weight='balanced'
    )
    clf.fit(X_train, y_train)
    
    print("\nModel Evaluation:")
    y_pred = clf.predict(X_test)
    print(classification_report(y_test, y_pred))
    
    print("Fitting SHAP TreeExplainer...")
    explainer = shap.TreeExplainer(clf)
    
    model_path = os.path.join("models", "random_forest_model.joblib")
    explainer_path = os.path.join("models", "shap_explainer.joblib")
    
    joblib.dump(clf, model_path)
    joblib.dump(explainer, explainer_path)
    
    print(f"Saved Random Forest Model to {model_path}")
    print(f"Saved SHAP Explainer to {explainer_path}")

if __name__ == "__main__":
    train_and_export_model()
