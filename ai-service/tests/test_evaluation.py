import tempfile
import unittest
from pathlib import Path
from unittest.mock import ANY, patch
from uuid import UUID

import numpy as np
import pandas as pd
import cv2
import torch
from fastapi import HTTPException
from fastapi.testclient import TestClient

from app.api.routes import evaluate as evaluate_route
from app.main import app
from app.model_registry import (
    UnsupportedAnalysisModelError,
    get_loaded_model,
    get_model_definition,
)
from app.utils.evaluate import compute_similarity_score, get_reconstruction_error
from app.utils.preprocess import preprocess
from app.utils.process_video import TraceSummary
from app.utils import process_video as process_video_module


class ModelRegistryTests(unittest.TestCase):
    def test_registered_model_is_cached(self):
        first = get_loaded_model("side_arms_raise_v1")
        second = get_loaded_model("side_arms_raise_v1")

        self.assertIs(first, second)

    def test_unknown_model_is_rejected(self):
        with self.assertRaises(UnsupportedAnalysisModelError):
            get_model_definition("unknown_model_v1")

    def test_known_motion_scores_above_intentionally_incorrect_motion(self):
        loaded_model = get_loaded_model("side_arms_raise_v1")
        training_trace = next(
            (Path(__file__).resolve().parents[1] / "data" / "shoulder_exercise_1").glob(
                "*.csv"
            )
        )
        known_motion, _ = preprocess(
            training_trace,
            loaded_model.definition.input_frames,
            loaded_model.definition.features,
        )

        incorrect_motions = []
        for elbow_coordinates in (
            np.array([3.0, 3.0, 3.0, 3.0], dtype=np.float32),
            np.array([-3.0, 3.0, 3.0, 3.0], dtype=np.float32),
            np.array([-3.0, 3.0, 3.0, -3.0], dtype=np.float32),
        ):
            incorrect_motion = known_motion.copy()
            incorrect_motion[:, :, 4:] = elbow_coordinates
            incorrect_motions.append(incorrect_motion)

        def score(motion):
            error = get_reconstruction_error(loaded_model.model, motion)
            return compute_similarity_score(
                error,
                loaded_model.mean_val_loss,
                loaded_model.beta,
            )

        known_score = score(known_motion)
        incorrect_scores = [score(motion) for motion in incorrect_motions]

        self.assertGreaterEqual(known_score, 80.0)
        self.assertTrue(all(value < 50.0 for value in incorrect_scores))
        self.assertTrue(all(known_score > value for value in incorrect_scores))


class TracePreprocessingTests(unittest.TestCase):
    def test_preprocess_reads_only_the_requested_trace(self):
        features = get_model_definition("side_arms_raise_v1").features

        with tempfile.TemporaryDirectory() as temporary_directory:
            directory = Path(temporary_directory)
            requested_trace = directory / "current.csv"
            stale_trace = directory / "stale.csv"
            frame = pd.DataFrame(
                {
                    "frame": [0, 1, 2],
                    "Left Shoulder_x": [0.3, 0.3, 0.3],
                    "Left Shoulder_y": [0.4, 0.4, 0.4],
                    "Right Shoulder_x": [0.7, 0.7, 0.7],
                    "Right Shoulder_y": [0.4, 0.4, 0.4],
                    "Left Elbow_x": [0.2, 0.2, 0.2],
                    "Left Elbow_y": [0.5, 0.4, 0.3],
                    "Right Elbow_x": [0.8, 0.8, 0.8],
                    "Right Elbow_y": [0.5, 0.4, 0.3],
                }
            )
            frame.to_csv(requested_trace, index=False)
            stale_trace.write_text("not,the,current,trace\n", encoding="utf-8")

            data, input_dimension = preprocess(
                requested_trace,
                target_frames=200,
                expected_features=features,
            )

        self.assertEqual(data.shape, (1, 200, len(features)))
        self.assertEqual(input_dimension, len(features))


class VideoProcessingTests(unittest.TestCase):
    def test_long_recordings_are_uniformly_capped_at_model_frame_count(self):
        frame_count = 240
        keypoint_coordinates = torch.zeros((1, 17, 2), dtype=torch.float32)
        keypoint_coordinates[0, :, 0] = 160
        keypoint_coordinates[0, :, 1] = 120
        mock_keypoints = type(
            "MockKeypoints",
            (),
            {"xy": keypoint_coordinates},
        )()
        mock_result = type(
            "MockResult",
            (),
            {"keypoints": mock_keypoints},
        )()

        with tempfile.TemporaryDirectory() as temporary_directory:
            directory = Path(temporary_directory)
            video_path = directory / "recording.avi"
            trace_path = directory / "trace.csv"
            writer = cv2.VideoWriter(
                str(video_path),
                cv2.VideoWriter_fourcc(*"MJPG"),
                20.0,
                (320, 240),
            )
            self.assertTrue(writer.isOpened())
            for _ in range(frame_count):
                writer.write(np.zeros((240, 320, 3), dtype=np.uint8))
            writer.release()

            with patch.object(
                process_video_module,
                "pose_model",
                return_value=[mock_result],
            ) as mocked_pose_model:
                summary = process_video_module.process_video_to_csv(
                    str(video_path),
                    str(trace_path),
                )

        self.assertEqual(summary.total_frames, frame_count)
        self.assertEqual(summary.pose_frames, process_video_module.MAX_ANALYSIS_FRAMES)
        self.assertEqual(
            mocked_pose_model.call_count,
            process_video_module.MAX_ANALYSIS_FRAMES,
        )
        mocked_pose_model.assert_called_with(
            ANY,
            verbose=False,
            imgsz=process_video_module.POSE_INFERENCE_SIZE,
            max_det=1,
        )


class EvaluationRouteTests(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)

    def test_recording_failures_are_explicit(self):
        cases = (
            (
                TraceSummary(total_frames=10, pose_frames=10, duration_seconds=1.0),
                "too short",
            ),
            (
                TraceSummary(total_frames=30, pose_frames=0, duration_seconds=3.0),
                "No person",
            ),
            (
                TraceSummary(total_frames=30, pose_frames=10, duration_seconds=3.0),
                "Not enough clear pose frames",
            ),
        )

        for summary, expected_message in cases:
            with self.subTest(summary=summary):
                with self.assertRaises(HTTPException) as context:
                    evaluate_route._validate_trace_summary(summary)

                self.assertEqual(context.exception.status_code, 422)
                self.assertIn(expected_message, context.exception.detail)

    def test_unknown_or_unavailable_model_cannot_produce_a_score(self):
        unknown_response = self.client.post(
            "/evaluate/unknown_model_v1",
            files={"video": ("recording.webm", b"video", "video/webm")},
        )

        with patch.object(
            evaluate_route,
            "get_loaded_model",
            side_effect=FileNotFoundError,
        ):
            unavailable_response = self.client.post(
                "/evaluate/side_arms_raise_v1",
                files={"video": ("recording.webm", b"video", "video/webm")},
            )

        self.assertEqual(unknown_response.status_code, 404)
        self.assertNotIn("score", unknown_response.json())
        self.assertEqual(unavailable_response.status_code, 503)
        self.assertNotIn("score", unavailable_response.json())

    def test_each_request_gets_a_unique_id_and_cleans_temporary_files(self):
        before = set(evaluate_route.EVALUATION_TEMP_ROOT.glob("*"))
        valid_summary = TraceSummary(
            total_frames=30,
            pose_frames=30,
            duration_seconds=3.0,
        )

        with (
            patch.object(evaluate_route, "get_loaded_model", return_value=object()),
            patch.object(
                evaluate_route,
                "process_video_to_csv",
                return_value=valid_summary,
            ),
            patch.object(evaluate_route, "_score_trace", return_value=(0.01, 92.5)),
        ):
            responses = [
                self.client.post(
                    "/evaluate/side_arms_raise_v1",
                    files={"video": ("recording.webm", b"video", "video/webm")},
                )
                for _ in range(2)
            ]

        evaluation_ids = [response.json()["evaluationId"] for response in responses]

        self.assertTrue(all(response.status_code == 200 for response in responses))
        self.assertNotEqual(evaluation_ids[0], evaluation_ids[1])
        self.assertTrue(all(str(UUID(evaluation_id)) == evaluation_id for evaluation_id in evaluation_ids))
        self.assertEqual(set(evaluate_route.EVALUATION_TEMP_ROOT.glob("*")), before)


if __name__ == "__main__":
    unittest.main()
