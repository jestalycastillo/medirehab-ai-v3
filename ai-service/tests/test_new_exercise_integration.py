import tempfile
import unittest
from pathlib import Path

import numpy as np
import pandas as pd
from fastapi.testclient import TestClient

from app.main import app
from app.model_registry import get_loaded_model
from app.pose_features import UPPER_BODY_FEATURES
from app.utils.preprocess import canonicalize_right, preprocess, TracePreprocessingError
from app.utils.evaluate import compute_calibrated_similarity_score, get_new_exercise_feedback


class NewExerciseIntegrationTests(unittest.TestCase):
    def test_all_four_checkpoints_load_with_correct_metadata(self):
        for key in ("arm_circumduction", "cross_body_shoulder_stretch", "external_rotation", "internal_rotation"):
            loaded = get_loaded_model(key)
            self.assertEqual(loaded.definition.features, UPPER_BODY_FEATURES)
            self.assertEqual(loaded.definition.scoring_mode, "similarity")
            self.assertGreater(loaded.beta, 0)
            self.assertEqual(loaded.definition.canonical_side, "left" if key in ("arm_circumduction", "cross_body_shoulder_stretch") else None)

    def test_equivalent_left_right_inputs_have_identical_normalized_features(self):
        trace = pd.DataFrame([{name: 0.1 + index / 30 + frame / 1000 for index, name in enumerate(UPPER_BODY_FEATURES)} for frame in range(20)])
        trace["frame"] = np.arange(20)
        with tempfile.TemporaryDirectory() as folder:
            left = Path(folder) / "left.csv"
            right = Path(folder) / "right.csv"
            trace.to_csv(left, index=False)
            canonicalize_right(trace).to_csv(right, index=False)
            a, _ = preprocess(left, expected_features=UPPER_BODY_FEATURES, canonical_side="left", selected_side="left")
            b, _ = preprocess(right, expected_features=UPPER_BODY_FEATURES, canonical_side="left", selected_side="right")
            np.testing.assert_allclose(a, b, atol=1e-5)
            with self.assertRaises(TracePreprocessingError):
                preprocess(left, expected_features=UPPER_BODY_FEATURES, canonical_side="left")

    def test_missing_wrists_are_rejected(self):
        trace = pd.DataFrame([{name: 0.3 for name in UPPER_BODY_FEATURES}] * 20)
        trace["frame"] = np.arange(20)
        trace["Right Wrist_x"] = trace["Right Wrist_y"] = 0
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / "trace.csv"
            trace.to_csv(path, index=False)
            with self.assertRaisesRegex(TracePreprocessingError, "right wrist"):
                preprocess(path, expected_features=UPPER_BODY_FEATURES)

    def test_arm_selection_is_validated_before_extracting_video(self):
        client = TestClient(app)
        for key in ("arm_circumduction", "cross_body_shoulder_stretch"):
            response = client.post(f"/evaluate/{key}", files={"video": ("recording.mp4", b"video", "video/mp4")})
            self.assertEqual(response.status_code, 400)
        response = client.post("/evaluate/external_rotation", data={"selected_side": "left"}, files={"video": ("recording.mp4", b"video", "video/mp4")})
        self.assertEqual(response.status_code, 400)

    def test_similarity_matches_training_calibration_without_elevation_rules(self):
        self.assertEqual(compute_calibrated_similarity_score(0.1, 0.1, 10), 100)
        self.assertAlmostEqual(compute_calibrated_similarity_score(0.2, 0.1, 10), 36.79)
        for key in ("arm_circumduction", "cross_body_shoulder_stretch", "external_rotation", "internal_rotation"):
            feedback = " ".join(get_new_exercise_feedback(80, key))
            self.assertNotIn("raise", feedback.lower())
            self.assertNotIn("flexion", feedback.lower())


if __name__ == "__main__":
    unittest.main()
