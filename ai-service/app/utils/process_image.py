from ultralytics import YOLO
from PIL import Image
import numpy as np

model = YOLO("yolo26s-pose.pt")

BODY_PARTS = [
    "Nose", "Left Eye", "Right Eye", "Left Ear", "Right Ear",
    "Left Shoulder", "Right Shoulder",
    "Left Elbow", "Right Elbow",
    "Left Wrist", "Right Wrist",
    "Left Hip", "Right Hip",
    "Left Knee", "Right Knee",
    "Left Ankle", "Right Ankle"
]

keep_indices = [0, 5, 6, 7, 8]


def process_image(image):
    """
    image: PIL.Image or numpy.ndarray

    Returns:
        {
            "Left Shoulder": {"x": ..., "y": ...},
            ...
        }
    """

    if isinstance(image, Image.Image):
        image = np.array(image)

    height, width = image.shape[:2]

    results = model(image, verbose=False)

    keypoints = results[0].keypoints

    if keypoints is None or len(keypoints.xy) == 0:
        return None

    xy = keypoints.xy[0]

    landmarks = {
        "Chest": {
            "x": (xy[5][0].item() + xy[6][0].item()) / (2 * width),
            "y": (xy[5][1].item() + xy[6][1].item()) / (2 * height),
        }
    }

    for idx in keep_indices:

        landmarks[BODY_PARTS[idx]] = {
            "x": xy[idx][0].item() / width,
            "y": xy[idx][1].item() / height
        }

    return landmarks