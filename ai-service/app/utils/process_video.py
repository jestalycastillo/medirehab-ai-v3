import csv
import os
from dataclasses import dataclass
from pathlib import Path
from threading import Lock

import cv2
from ultralytics import YOLO

POSE_CHECKPOINT_PATH = Path(__file__).resolve().parents[2] / "yolo26s-pose.pt"
pose_model = YOLO(POSE_CHECKPOINT_PATH)
pose_inference_lock = Lock()

BODY_PARTS = [
    "Nose", "Left Eye", "Right Eye", "Left Ear", "Right Ear",
    "Left Shoulder", "Right Shoulder",
    "Left Elbow", "Right Elbow",
    "Left Wrist", "Right Wrist",
    "Left Hip", "Right Hip",
    "Left Knee", "Right Knee",
    "Left Ankle", "Right Ankle"
]

KEEP_INDICES = (5, 6, 7, 8)
MAX_ANALYSIS_FRAMES = 200
POSE_INFERENCE_SIZE = 640
FALLBACK_ANALYSIS_FPS = 10.0


class VideoProcessingError(ValueError):
    pass


@dataclass(frozen=True)
class TraceSummary:
    total_frames: int
    pose_frames: int
    duration_seconds: float | None


def _analysis_frame_indices(frame_count: int) -> set[int] | None:
    if frame_count <= 0:
        return None

    sample_count = min(frame_count, MAX_ANALYSIS_FRAMES)
    if sample_count == 1:
        return {0}

    last_frame_index = frame_count - 1
    return {
        round(sample_index * last_frame_index / (sample_count - 1))
        for sample_index in range(sample_count)
    }


def process_video_to_csv(video_path, output_csv_path) -> TraceSummary:
    """
    Reads a video file frame-by-frame, runs YOLO Pose estimation, 
    and saves keypoint coordinates of shoulders and elbows to a CSV file.
    """
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        raise VideoProcessingError("The exercise recording could not be opened.")

    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))

    if width <= 0 or height <= 0:
        cap.release()
        raise VideoProcessingError("The exercise recording has invalid dimensions.")

    fps = float(cap.get(cv2.CAP_PROP_FPS))
    frame_count_hint = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    analysis_indices = _analysis_frame_indices(frame_count_hint)
    fallback_stride = max(
        1,
        round(fps / FALLBACK_ANALYSIS_FPS) if fps > 0 else 1,
    )
    os.makedirs(os.path.dirname(output_csv_path), exist_ok=True)

    total_frames = 0
    pose_frames = 0
    analyzed_frames = 0

    try:
        with open(output_csv_path, "w", newline="") as file:
            writer = csv.writer(file)
            header = ["frame"]
            for idx in KEEP_INDICES:
                part = BODY_PARTS[idx]
                header += [f"{part}_x", f"{part}_y"]
            writer.writerow(header)

            while True:
                frame_available, frame = cap.read()
                if not frame_available:
                    break

                should_analyze = (
                    total_frames in analysis_indices
                    if analysis_indices is not None
                    else (
                        analyzed_frames < MAX_ANALYSIS_FRAMES
                        and total_frames % fallback_stride == 0
                    )
                )

                if should_analyze:
                    with pose_inference_lock:
                        results = pose_model(
                            frame,
                            verbose=False,
                            imgsz=POSE_INFERENCE_SIZE,
                            max_det=1,
                        )
                    analyzed_frames += 1
                    keypoints = results[0].keypoints

                    if (
                        keypoints is not None
                        and keypoints.xy is not None
                        and len(keypoints.xy) > 0
                    ):
                        xy = keypoints.xy[0]
                        row = [total_frames]
                        for idx in KEEP_INDICES:
                            x = xy[idx][0].item() / width
                            y = xy[idx][1].item() / height
                            row += [x, y]
                        writer.writerow(row)
                        pose_frames += 1

                total_frames += 1
    finally:
        cap.release()

    duration_seconds = total_frames / fps if fps > 0 else None
    return TraceSummary(
        total_frames=total_frames,
        pose_frames=pose_frames,
        duration_seconds=duration_seconds,
    )
