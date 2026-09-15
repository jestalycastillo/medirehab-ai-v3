import math
from typing import Dict, Any, Tuple


def calculate_angles(landmarks: Dict[str, Any]) -> Tuple[float, float]:
    """
    Calculates arm elevation angles for both arms.
    If Chest landmark is available, measures torso-referenced arm elevation.
    """
    chest = landmarks.get("Chest")
    if chest is not None:
        left = torso_relative_arm_angle(
            chest,
            landmarks["Left Shoulder"],
            landmarks["Left Elbow"],
        )
        right = torso_relative_arm_angle(
            chest,
            landmarks["Right Shoulder"],
            landmarks["Right Elbow"],
        )
    else:
        left = arm_angle(
            landmarks["Left Shoulder"],
            landmarks["Left Elbow"],
        )
        right = arm_angle(
            landmarks["Right Shoulder"],
            landmarks["Right Elbow"],
        )
    
    return left, right


def arm_angle(shoulder: Dict[str, float], elbow: Dict[str, float]) -> float:
    """Calculates angle of the arm relative to horizontal axis."""
    dx = elbow["x"] - shoulder["x"]
    dy = shoulder["y"] - elbow["y"]
    return math.degrees(math.atan2(dy, dx))


def torso_relative_arm_angle(
    chest: Dict[str, float],
    shoulder: Dict[str, float],
    elbow: Dict[str, float],
) -> float:
    """
    Calculates arm elevation angle using the chest/torso vertical axis as reference.
    0° = arm aligned downward with torso
    90° = arm horizontal at shoulder level
    180° = arm elevated straight overhead
    """
    # Vector from shoulder to elbow
    arm_x = elbow["x"] - shoulder["x"]
    arm_y = elbow["y"] - shoulder["y"]

    arm_length = math.sqrt(arm_x**2 + arm_y**2)
    if arm_length < 1e-6:
        return 0.0

    # Downward vertical vector aligned with torso
    down_x = 0.0
    down_y = 1.0

    # Dot product with downward axis (y points downwards in normalized image coordinates)
    cos_val = max(-1.0, min(1.0, (arm_x * down_x + arm_y * down_y) / arm_length))
    return math.degrees(math.acos(cos_val))


def chest_shoulder_elbow_angle(
    chest: Dict[str, float],
    shoulder: Dict[str, float],
    elbow: Dict[str, float],
) -> float:
    """
    Calculates the 3-point biomechanical angle formed by Chest -> Shoulder -> Elbow.
    """
    # Vector 1: Shoulder -> Chest
    v1_x = chest["x"] - shoulder["x"]
    v1_y = chest["y"] - shoulder["y"]

    # Vector 2: Shoulder -> Elbow
    v2_x = elbow["x"] - shoulder["x"]
    v2_y = elbow["y"] - shoulder["y"]

    mag1 = math.sqrt(v1_x**2 + v1_y**2)
    mag2 = math.sqrt(v2_x**2 + v2_y**2)

    if mag1 * mag2 < 1e-6:
        return 0.0

    dot = v1_x * v2_x + v1_y * v2_y
    cos_theta = max(-1.0, min(1.0, dot / (mag1 * mag2)))
    return math.degrees(math.acos(cos_theta))