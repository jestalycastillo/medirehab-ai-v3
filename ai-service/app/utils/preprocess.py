import numpy as np
import pandas as pd


class TracePreprocessingError(ValueError):
    pass


def preprocess(
    trace_path,
    target_frames=200,
    expected_features=None,
):
    try:
        trace = pd.read_csv(trace_path)
    except (FileNotFoundError, pd.errors.EmptyDataError) as error:
        raise TracePreprocessingError(
            "No usable pose trace was produced for this recording."
        ) from error

    if "frame" not in trace.columns:
        raise TracePreprocessingError("The pose trace is missing its frame index.")

    feature_columns = list(expected_features or trace.columns.drop("frame"))
    missing_features = [
        feature for feature in feature_columns if feature not in trace.columns
    ]

    if missing_features:
        raise TracePreprocessingError(
            "The pose trace does not match the selected analysis model."
        )

    sequence_frame = trace.loc[:, feature_columns].copy()

    if len(sequence_frame) < 2:
        raise TracePreprocessingError(
            "Not enough pose frames were detected in the recording."
        )

    if not np.isfinite(sequence_frame.to_numpy(dtype=np.float32)).all():
        raise TracePreprocessingError("The pose trace contains invalid coordinates.")

    sequence_frame = normalize_pose(sequence_frame)
    sequence = sequence_frame.to_numpy(dtype=np.float32)
    sequence = resample_sequence(sequence, target_frames=target_frames)

    data = np.array([sequence], dtype=np.float32)

    input_dim = data.shape[2]

    return data, input_dim

def normalize_pose(df):

    # Shoulder center
    center_x = (df["Left Shoulder_x"] + df["Right Shoulder_x"]) / 2
    center_y = (df["Left Shoulder_y"] + df["Right Shoulder_y"]) / 2

    # Shoulder width per frame
    sw_per_frame = np.sqrt(
        (df["Left Shoulder_x"] - df["Right Shoulder_x"]) ** 2 +
        (df["Left Shoulder_y"] - df["Right Shoulder_y"]) ** 2
    )
    
    # Use median shoulder width to be robust against outliers/failures
    shoulder_width = float(np.median(sw_per_frame))
    if not np.isfinite(shoulder_width) or shoulder_width < 1e-6:
        raise TracePreprocessingError(
            "Shoulders were not visible enough to evaluate the recording."
        )

    # Normalize every keypoint
    for col in df.columns:

        if col.endswith("_x"):
            df[col] = (df[col] - center_x) / shoulder_width

        elif col.endswith("_y"):
            df[col] = (df[col] - center_y) / shoulder_width

    return df

def resample_sequence(sequence, target_frames):
    """
    sequence: numpy array of shape (frames, features)
    target_frames: desired number of frames

    Returns:
        numpy array of shape (target_frames, features)
    """

    if target_frames < 2:
        raise TracePreprocessingError("The analysis model frame count is invalid.")

    original_frames = sequence.shape[0]
    num_features = sequence.shape[1]

    # Original frame positions
    x_old = np.arange(original_frames)

    # New frame positions
    x_new = np.linspace(0, original_frames - 1, target_frames)

    # Output array
    resampled = np.zeros((target_frames, num_features), dtype=np.float32)

    # Interpolate each feature independently
    for i in range(num_features):
        resampled[:, i] = np.interp(
            x_new,
            x_old,
            sequence[:, i]
        )

    return resampled
