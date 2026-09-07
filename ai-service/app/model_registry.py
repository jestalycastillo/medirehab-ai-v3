from dataclasses import dataclass
from pathlib import Path
from threading import Lock

import torch
from torch import nn

from app.utils.build_model import build_model


class UnsupportedAnalysisModelError(ValueError):
    pass


@dataclass(frozen=True)
class AnalysisModelDefinition:
    checkpoint_path: Path
    input_frames: int
    features: tuple[str, ...]


@dataclass(frozen=True)
class LoadedAnalysisModel:
    definition: AnalysisModelDefinition
    model: nn.Module
    mean_val_loss: float
    beta: float
    inference_lock: Lock


MODEL_REGISTRY = {
    "side_arms_raise_v1": AnalysisModelDefinition(
        checkpoint_path=Path(__file__).resolve().parent
        / "models"
        / "side_arms_raise_v1.pth",
        input_frames=200,
        features=(
            "Left Shoulder_x",
            "Left Shoulder_y",
            "Right Shoulder_x",
            "Right Shoulder_y",
            "Left Elbow_x",
            "Left Elbow_y",
            "Right Elbow_x",
            "Right Elbow_y",
        ),
    )
}

_LOADED_MODELS: dict[str, LoadedAnalysisModel] = {}
_MODEL_LOAD_LOCK = Lock()


def get_model_definition(model_key: str) -> AnalysisModelDefinition:
    model_definition = MODEL_REGISTRY.get(model_key)

    if model_definition is None:
        raise UnsupportedAnalysisModelError(
            f"Unsupported analysis model: {model_key}"
        )

    return model_definition


def get_loaded_model(model_key: str) -> LoadedAnalysisModel:
    definition = get_model_definition(model_key)

    with _MODEL_LOAD_LOCK:
        loaded_model = _LOADED_MODELS.get(model_key)
        if loaded_model is not None:
            return loaded_model

        if not definition.checkpoint_path.exists():
            raise FileNotFoundError(
                f"Analysis checkpoint does not exist: {definition.checkpoint_path.name}"
            )

        checkpoint = torch.load(definition.checkpoint_path, map_location="cpu")
        model = build_model(len(definition.features))
        model.load_state_dict(checkpoint["model"])
        model.eval()

        loaded_model = LoadedAnalysisModel(
            definition=definition,
            model=model,
            mean_val_loss=float(checkpoint.get("mean_val_loss", 0.0)),
            beta=float(checkpoint.get("beta", 1.0)),
            inference_lock=Lock(),
        )
        _LOADED_MODELS[model_key] = loaded_model
        return loaded_model
