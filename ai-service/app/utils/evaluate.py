import math
from pathlib import Path
from typing import Optional, Union

import numpy as np
import pandas as pd
import torch

from app.utils.preprocess import preprocess, TracePreprocessingError


def get_reconstruction_error(model, sequence):
    """
    Computes reconstruction error (MSE) for a sequence.
    """
    model.eval()
    with torch.no_grad():
        if isinstance(sequence, np.ndarray):
            sequence = torch.tensor(sequence, dtype=torch.float32)
        if len(sequence.shape) == 2:
            sequence = sequence.unsqueeze(0)
        device = next(model.parameters()).device
        sequence = sequence.to(device)
        output = model(sequence)
        error = torch.mean((output - sequence) ** 2)
        return float(error.item())


def compute_arm_motion_stats(
    trace_path: Union[str, Path],
    model_key: str,
) -> tuple[float, float, float]:
    """
    Analyzes arm elevation angle across all recorded frames in the trace CSV.
    Angle definition:
      0°  = arm hanging straight down at side
      90° = arm horizontal at shoulder level
      180°= arm raised straight up overhead
    Returns:
      (min_angle_deg, max_angle_deg, range_of_motion_deg)
    """
    df = pd.read_csv(trace_path)
    key_lower = model_key.lower()

    if "left" in key_lower:
        sides = ["Left"]
    elif "right" in key_lower:
        sides = ["Right"]
    else:
        sides = ["Left", "Right"]

    all_angles = []
    for side in sides:
        sh_x_col, sh_y_col = f"{side} Shoulder_x", f"{side} Shoulder_y"
        el_x_col, el_y_col = f"{side} Elbow_x", f"{side} Elbow_y"

        if (
            sh_x_col not in df.columns
            or sh_y_col not in df.columns
            or el_x_col not in df.columns
            or el_y_col not in df.columns
        ):
            continue

        sh_x, sh_y = df[sh_x_col].to_numpy(), df[sh_y_col].to_numpy()
        el_x, el_y = df[el_x_col].to_numpy(), df[el_y_col].to_numpy()

        dx = el_x - sh_x
        dy = el_y - sh_y
        lengths = np.sqrt(dx**2 + dy**2)
        lengths = np.where(lengths < 1e-6, 1e-6, lengths)

        cos_vals = np.clip(dy / lengths, -1.0, 1.0)
        angles = np.arccos(cos_vals) * (180.0 / np.pi)
        all_angles.append(angles)

    if not all_angles:
        return 0.0, 0.0, 0.0

    combined_angles = np.mean(all_angles, axis=0)
    min_angle = float(np.min(combined_angles))
    max_angle = float(np.max(combined_angles))
    rom = max(0.0, max_angle - min_angle)
    return min_angle, max_angle, rom


def compute_similarity_score(
    error: float,
    mean_val_loss: float = 0.005,
    beta: float = 14.0,
) -> float:
    """
    Computes trajectory similarity score based on reconstruction error
    using smooth exponential decay anchored at optimal baseline loss.
    """
    base_error = 0.0015
    effective_error = max(0.0, float(error) - base_error)
    decay = min(max(beta, 8.0), 20.0) if beta > 0 else 14.0
    score = 100.0 * math.exp(-decay * effective_error)
    return round(float(np.clip(score, 5.0, 100.0)), 2)


def calculate_clinical_score(
    error: float,
    min_angle: float,
    max_angle: float,
    rom: float,
    beta: float = 14.0,
) -> float:
    """
    Computes comprehensive clinical score combining:
    1. Trajectory & posture accuracy from the neural autoencoder (45%)
    2. Range of Motion & peak arm elevation completion (55%)
    Also penalizes motionless / stationary recordings.
    """
    # 1. Trajectory score
    traj_score = compute_similarity_score(error, beta=beta)

    # 2. ROM & Movement completion score
    if rom < 25.0:
        # Stationary or barely moved
        rom_score = float(np.clip(rom * 1.0, 5.0, 25.0))
    elif max_angle < 80.0:
        # Partial arm lift
        rom_score = 30.0 + ((max_angle - 30.0) / 50.0) * 55.0
        rom_score = float(np.clip(rom_score, 25.0, 85.0))
    else:
        # Achieved target shoulder height or above
        target_score = 85.0 + min(15.0, ((max_angle - 80.0) / 20.0) * 15.0)
        # Verify return towards start position
        return_bonus = 5.0 if min_angle < 45.0 else -5.0
        rom_score = float(np.clip(target_score + return_bonus, 75.0, 100.0))

    # If motionless, trajectory score cannot artificially elevate the final score
    if rom < 25.0:
        final_score = min(rom_score, traj_score)
    else:
        final_score = 0.45 * traj_score + 0.55 * rom_score

    return round(float(np.clip(final_score, 0.0, 100.0)), 2)


def get_score_feedback(
    score: float,
    model_key: str,
    max_angle: Optional[float] = None,
    rom: Optional[float] = None,
) -> list[str]:
    """
    Generates tailored, actionable clinical feedback based on the exercise,
    side, achieved range of motion, and performance score.
    """
    key_lower = model_key.lower()
    is_flexion = "flexion" in key_lower
    is_abduction = "abduction" in key_lower or "side_arms" in key_lower
    side_str = "left" if "left" in key_lower else ("right" if "right" in key_lower else "")
    arm_desc = f"{side_str} arm" if side_str else "arms"

    if rom is not None and rom < 25.0:
        return [
            f"No significant movement detected on your {arm_desc}. Make sure you raise your {arm_desc} through the full range of motion."
        ]

    if is_flexion:
        exercise_name = "Shoulder Flexion"
        movement_cue = f"raise your {arm_desc} straight forward to shoulder height (~90°)"
    elif is_abduction:
        exercise_name = "Shoulder Abduction"
        movement_cue = f"raise your {arm_desc} sideways to shoulder level (~90°)"
    else:
        exercise_name = "Exercise"
        movement_cue = f"move your {arm_desc} with steady control through the target range of motion"

    peak_info = f" (peak elevation {max_angle:.0f}°)" if max_angle is not None else ""

    if score >= 90.0:
        return [
            f"Excellent execution of the {exercise_name}{peak_info}! You maintained steady control and reached the target range of motion."
        ]
    elif score >= 75.0:
        return [
            f"Good form on the {exercise_name}{peak_info}. Focus on maintaining a smooth, steady pace and keeping your {arm_desc} aligned."
        ]
    elif score >= 50.0:
        return [
            f"Moderate effort. Try to {movement_cue}, hold for a moment at the peak, and lower smoothly."
        ]
    else:
        return [
            f"Focus on the basic movement pattern: {movement_cue} without shrugging or rushing."
        ]
