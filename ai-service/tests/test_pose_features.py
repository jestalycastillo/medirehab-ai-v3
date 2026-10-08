import unittest

from app.pose_features import EXERCISE_FEATURES, LEGACY_SHOULDER_FEATURES, keypoint_indices_for_features


class PoseFeatureTests(unittest.TestCase):
    def test_new_exercises_extract_wrists_without_lower_body(self):
        for exercise in ("arm_circumduction", "cross_body_shoulder_stretch", "external_rotation", "internal_rotation"):
            with self.subTest(exercise=exercise):
                features = EXERCISE_FEATURES[exercise]
                self.assertEqual(len(features), 16)
                self.assertEqual(keypoint_indices_for_features(features), (0, 5, 6, 7, 8, 9, 10))

    def test_legacy_tensor_shape_is_preserved(self):
        self.assertEqual(len(LEGACY_SHOULDER_FEATURES), 12)
        self.assertEqual(keypoint_indices_for_features(LEGACY_SHOULDER_FEATURES), (0, 5, 6, 7, 8))

    def test_incomplete_or_unknown_features_are_rejected(self):
        for features in (LEGACY_SHOULDER_FEATURES + ("Left Wrist_x",), LEGACY_SHOULDER_FEATURES + ("Thumb_x", "Thumb_y"), ()):
            with self.assertRaises(ValueError):
                keypoint_indices_for_features(features)


if __name__ == "__main__":
    unittest.main()
