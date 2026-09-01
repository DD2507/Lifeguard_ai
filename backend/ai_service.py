import os
import joblib
import numpy as np
import pandas as pd
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

# Initialize FastAPI App
app = FastAPI(title="LifeGuard AI - Machine Learning & SHAP Microservice", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load Model & SHAP Explainer
MODEL_PATH = os.path.join("models", "random_forest_model.joblib")
EXPLAINER_PATH = os.path.join("models", "shap_explainer.joblib")

model = None
explainer = None

def load_artifacts():
    global model, explainer
    if os.path.exists(MODEL_PATH) and os.path.exists(EXPLAINER_PATH):
        model = joblib.load(MODEL_PATH)
        explainer = joblib.load(EXPLAINER_PATH)
        print("Successfully loaded Random Forest Model and SHAP Explainer.")
    else:
        print("Warning: Model artifacts not found. Please run train_model.py first.")

load_artifacts()

# Pydantic Schemas
class PatientRoomVitalsInput(BaseModel):
    heartRate: float = Field(..., example=108.0)
    spo2: float = Field(..., example=92.0)
    temperature: float = Field(..., example=38.2)
    roomTemperature: float = Field(24.0, example=32.0)
    humidity: float = Field(50.0, example=75.0)
    airQuality: float = Field(100.0, example=220.0)

FEATURE_DISPLAY_NAMES = {
    'heartRate': 'Heart Rate',
    'spo2': 'SpO₂',
    'temperature': 'Body Temperature',
    'roomTemperature': 'Room Temperature',
    'humidity': 'Room Humidity',
    'airQuality': 'Air Quality (MQ135)'
}

@app.get("/")
def health_check():
    return {
        "status": "online",
        "service": "LifeGuard AI ML & SHAP Engine",
        "modelLoaded": model is not None
    }

@app.post("/api/ai/predict")
def predict_risk_and_explain(data: PatientRoomVitalsInput):
    if model is None or explainer is None:
        load_artifacts()
        if model is None:
            raise HTTPException(status_code=500, detail="AI Model not loaded on server.")
            
    input_df = pd.DataFrame([{
        'heartRate': data.heartRate,
        'spo2': data.spo2,
        'temperature': data.temperature,
        'roomTemperature': data.roomTemperature,
        'humidity': data.humidity,
        'airQuality': data.airQuality
    }])
    
    # 1. Random Forest Inference
    prediction = model.predict(input_df)[0]
    probabilities = model.predict_proba(input_df)[0]
    
    # Get index of predicted class
    class_idx = list(model.classes_).index(prediction)
    risk_score = float(probabilities[class_idx])
    
    # 2. SHAP Values Computation
    shap_values = explainer.shap_values(input_df)
    
    # Check shape of SHAP values (multi-class tree explainer returns shape [samples, features, classes] or list of [samples, features])
    if isinstance(shap_values, list):
        # List of arrays per class
        class_shap = shap_values[class_idx][0]
    elif len(shap_values.shape) == 3:
        # [1, n_features, n_classes]
        class_shap = shap_values[0, :, class_idx]
    else:
        class_shap = shap_values[0]
        
    feature_names = input_df.columns.tolist()
    
    # Create feature impact list sorted by absolute SHAP impact magnitude
    shap_reasons = []
    for feat_name, shap_val, feat_val in zip(feature_names, class_shap, input_df.iloc[0]):
        display_name = FEATURE_DISPLAY_NAMES.get(feat_name, feat_name)
        impact_pct = round(float(shap_val) * 100, 1)
        
        severity = "NORMAL"
        if abs(impact_pct) > 15.0:
            severity = "HIGH"
        elif abs(impact_pct) > 5.0:
            severity = "MODERATE"
            
        direction = "elevated" if impact_pct > 0 else "reduced"
        
        shap_reasons.append({
            "factor": display_name,
            "value": float(feat_val),
            "shapValue": round(float(shap_val), 4),
            "impactPct": impact_pct,
            "severity": severity,
            "explanation": f"{display_name} of {feat_val} {direction} risk prediction by {abs(impact_pct)}% (SHAP attribution)."
        })
        
    # Sort by highest absolute SHAP impact
    shap_reasons.sort(key=lambda x: abs(x['shapValue']), reverse=True)
    
    # Top contributing positive factors
    top_factors = [r['factor'] for r in shap_reasons if r['shapValue'] > 0][:3]
    summary_text = (
        f"{prediction} risk predicted by Random Forest (Confidence: {int(risk_score*100)}%). "
        f"Key drivers: {', '.join(top_factors) if top_factors else 'All metrics within normal range'}."
    )
    
    # Actuation recommendation
    fan = data.roomTemperature > 30 or data.humidity > 70 or data.airQuality > 200
    buzzer = prediction == "HIGH"
    
    action_reason = "No immediate room intervention required."
    if fan and buzzer:
        action_reason = "High patient risk & elevated room temperature/air quality require active ventilation & buzzer alert."
    elif fan:
        action_reason = "Room temperature or humidity is elevated. Fan activation recommended."
    elif buzzer:
        action_reason = "High patient risk detected. Buzzer alarm recommended."
        
    return {
        "risk": prediction,
        "riskScore": round(risk_score, 2),
        "riskReasons": shap_reasons,
        "riskSummary": summary_text,
        "recommendedAction": {
            "fan": fan,
            "buzzer": buzzer,
            "reason": action_reason
        }
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("ai_service:app", host="0.0.0.0", port=8000, reload=True)
