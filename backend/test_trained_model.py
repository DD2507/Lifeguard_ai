import os
import unittest

import joblib
import pandas as pd


ROOT = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.path.join(ROOT, "models", "random_forest_model.joblib")


class TrainedModelDemoCases(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.model = joblib.load(MODEL_PATH)
        cls.columns = list(cls.model.feature_names_in_)

    def predict(self, heart_rate):
        values = {
            "heartRate": heart_rate,
            "spo2": 97,
            "temperature": 36.7,
            "roomTemperature": 24,
            "humidity": 45,
            "airQuality": 100,
            "hrDeviation": heart_rate - 80,
            "spo2Deviation": 0,
            "tempDeviation": 0,
        }
        frame = pd.DataFrame([[values[name] for name in self.columns]], columns=self.columns)
        return self.model.predict(frame)[0]

    def test_normal_resting_heart_rate_is_low(self):
        self.assertEqual(self.predict(80), "LOW")

    def test_heart_rate_just_above_normal_is_not_low(self):
        self.assertIn(self.predict(101), {"MODERATE", "HIGH"})

    def test_clearly_elevated_heart_rate_is_high(self):
        self.assertEqual(self.predict(130), "HIGH")


if __name__ == "__main__":
    unittest.main()
