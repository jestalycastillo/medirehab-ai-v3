import torch
import numpy as np

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
        return error.item()

def compute_similarity_score(error, mean_val_loss, beta):
    """
    Computes the similarity score based on reconstruction error using calibrated exponential decay.
    """
    if error <= mean_val_loss:
        return 100.0
    score = 100.0 * np.exp(-beta * (error - mean_val_loss))
    return round(float(np.clip(score, 0.0, 100.0)), 2)

def get_score_feedback(score: float, exercise_id: str) -> list[str]:
    """
    Classifies the score into levels and returns fixed feedback sentences,
    personalized to the exercise being performed.
    """
    normalized_id = exercise_id.lower().replace(" ", "_")

    if normalized_id in {"shoulder_flexion", "left_flexion", "right_flexion"}:
        if score >= 90.0:
            return ["Excellent shoulder flexion. You lifted the target arm with steady control."]
        elif score >= 75.0:
            return ["Good form. Raise the target arm forward to shoulder level without rushing."]
        elif score >= 50.0:
            return ["Lift the target arm forward to shoulder level and keep your torso steady."]
        else:
            return ["Raise the target arm forward to shoulder height, then lower it slowly."]

    elif normalized_id in {"shoulder_abduction", "left_abduction", "right_abduction"}:
        if score >= 90.0:
            return ["Excellent shoulder abduction. You lifted the target arm sideways with steady control."]
        elif score >= 75.0:
            return ["Good form. Keep the target arm straight as you lift it sideways."]
        elif score >= 50.0:
            return ["Lift the target arm sideways to shoulder level without shrugging."]
        else:
            return ["Raise the target arm sideways to shoulder height, then lower it slowly."]

    else:
        if score >= 90.0:
            return ["Excellent form! You maintained steady control and achieved the target range of motion."]
        elif score >= 75.0:
            return ["Good effort. Focus on maintaining a steady pace and correct joint alignment."]
        elif score >= 50.0:
            return ["Pay closer attention to your range of motion and try to keep your movements smooth and steady."]
        else:
            return ["Focus on the basic movement pattern. Try to control your pace and complete the full range of motion."]
