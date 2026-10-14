"""Ordered pose features shared by training and video extraction.

Profiles describe input tensors, not trained checkpoints. New exercises must
be trained with their profile before being added to the model registry.
"""

BODY_PARTS = (
    "Nose", "Left Eye", "Right Eye", "Left Ear", "Right Ear",
    "Left Shoulder", "Right Shoulder", "Left Elbow", "Right Elbow",
    "Left Wrist", "Right Wrist", "Left Hip", "Right Hip",
    "Left Knee", "Right Knee", "Left Ankle", "Right Ankle",
)


def coordinate_features(parts):
    return tuple(f"{part}_{axis}" for part in parts for axis in ("x", "y"))


LEGACY_SHOULDER_FEATURES = coordinate_features((
    "Chest", "Nose", "Left Shoulder", "Right Shoulder",
    "Left Elbow", "Right Elbow",
))

# Both arms preserve the assisting arm in cross-body stretches and support
# a common left/right representation. Wrists capture forearm/hand trajectories.
# Hips are omitted because the supplied upper-body recordings crop them.
UPPER_BODY_FEATURES = coordinate_features((
    "Chest", "Nose", "Left Shoulder", "Right Shoulder",
    "Left Elbow", "Right Elbow", "Left Wrist", "Right Wrist",
))

EXERCISE_FEATURES = {
    "shoulder_flexion": LEGACY_SHOULDER_FEATURES,
    "shoulder_abduction": LEGACY_SHOULDER_FEATURES,
    "arm_circumduction": UPPER_BODY_FEATURES,
    "cross_body_shoulder_stretch": UPPER_BODY_FEATURES,
    "external_rotation": UPPER_BODY_FEATURES,
    "internal_rotation": UPPER_BODY_FEATURES,
}


def keypoint_indices_for_features(features):
    """Resolve complete x/y pairs to YOLO indices; Chest is derived separately."""
    features = tuple(features)
    if len(set(features)) != len(features):
        raise ValueError("Pose features must be unique.")
    parts = []
    for feature in features:
        part, separator, axis = feature.rpartition("_")
        if not separator or axis not in ("x", "y") or part not in ("Chest", *BODY_PARTS):
            raise ValueError(f"Unsupported pose feature: {feature}")
        if part not in parts:
            parts.append(part)
    for part in parts:
        if any(f"{part}_{axis}" not in features for axis in ("x", "y")):
            raise ValueError(f"Pose features require both coordinates for {part}.")
    if any(part not in parts for part in ("Chest", "Left Shoulder", "Right Shoulder")):
        raise ValueError("Pose features require Chest and both shoulders for normalization.")
    return tuple(BODY_PARTS.index(part) for part in parts if part != "Chest")
