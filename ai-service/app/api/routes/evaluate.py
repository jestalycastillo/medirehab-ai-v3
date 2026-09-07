from pathlib import Path
from tempfile import TemporaryDirectory
from typing import BinaryIO
from uuid import uuid4

from fastapi import APIRouter, File, HTTPException, UploadFile
from starlette.concurrency import run_in_threadpool

from app.model_registry import (
    LoadedAnalysisModel,
    UnsupportedAnalysisModelError,
    get_loaded_model,
)
from app.utils.evaluate import compute_similarity_score, get_reconstruction_error
from app.utils.preprocess import TracePreprocessingError, preprocess
from app.utils.process_video import (
    TraceSummary,
    VideoProcessingError,
    process_video_to_csv,
)

router = APIRouter(
    prefix="/evaluate",
    tags=["evaluate"],
)

EVALUATION_TEMP_ROOT = Path(__file__).resolve().parents[3] / "data" / "evaluations"
MAX_UPLOAD_BYTES = 50 * 1024 * 1024
UPLOAD_CHUNK_BYTES = 1024 * 1024
MIN_RECORDING_SECONDS = 2.0
MIN_TOTAL_FRAMES = 20
MIN_POSE_FRAMES = 15
ALLOWED_VIDEO_TYPES = {
    "application/octet-stream": ".webm",
    "video/mp4": ".mp4",
    "video/quicktime": ".mov",
    "video/webm": ".webm",
    "video/x-msvideo": ".avi",
}


def _save_upload(source: BinaryIO, destination_path: Path) -> int:
    total_bytes = 0

    with destination_path.open("wb") as destination:
        while chunk := source.read(UPLOAD_CHUNK_BYTES):
            total_bytes += len(chunk)

            if total_bytes > MAX_UPLOAD_BYTES:
                return total_bytes

            destination.write(chunk)

    return total_bytes


def _validate_trace_summary(summary: TraceSummary) -> None:
    if (
        summary.total_frames < MIN_TOTAL_FRAMES
        or (
            summary.duration_seconds is not None
            and summary.duration_seconds < MIN_RECORDING_SECONDS
        )
    ):
        raise HTTPException(
            status_code=422,
            detail="The exercise recording is too short to evaluate.",
        )

    if summary.pose_frames == 0:
        raise HTTPException(
            status_code=422,
            detail="No person was detected in the exercise recording.",
        )

    if summary.pose_frames < MIN_POSE_FRAMES:
        raise HTTPException(
            status_code=422,
            detail="Not enough clear pose frames were detected. Keep your upper body visible and try again.",
        )


def _score_trace(
    loaded_model: LoadedAnalysisModel,
    trace_path: Path,
) -> tuple[float, float]:
    data, input_dim = preprocess(
        trace_path,
        target_frames=loaded_model.definition.input_frames,
        expected_features=loaded_model.definition.features,
    )

    if input_dim != len(loaded_model.definition.features):
        raise TracePreprocessingError(
            "The pose trace does not match the selected analysis model."
        )

    with loaded_model.inference_lock:
        error = get_reconstruction_error(loaded_model.model, data)

    score = compute_similarity_score(
        error,
        loaded_model.mean_val_loss,
        loaded_model.beta,
    )
    return error, score


@router.post("/{model_key}")
async def evaluate(model_key: str, video: UploadFile = File(...)):
    content_type = (video.content_type or "").split(";", 1)[0].strip().lower()
    extension = ALLOWED_VIDEO_TYPES.get(content_type)

    if extension is None:
        raise HTTPException(
            status_code=415,
            detail="Unsupported exercise recording format.",
        )

    try:
        loaded_model = await run_in_threadpool(get_loaded_model, model_key)
    except UnsupportedAnalysisModelError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    except (FileNotFoundError, KeyError, RuntimeError) as error:
        raise HTTPException(
            status_code=503,
            detail="The selected analysis model is unavailable.",
        ) from error

    evaluation_id = str(uuid4())
    EVALUATION_TEMP_ROOT.mkdir(parents=True, exist_ok=True)

    try:
        with TemporaryDirectory(
            prefix=f"{evaluation_id}_",
            dir=EVALUATION_TEMP_ROOT,
        ) as temporary_directory:
            evaluation_directory = Path(temporary_directory)
            video_path = evaluation_directory / f"recording{extension}"
            trace_path = evaluation_directory / "trace.csv"
            uploaded_bytes = await run_in_threadpool(
                _save_upload,
                video.file,
                video_path,
            )

            if uploaded_bytes == 0:
                raise HTTPException(
                    status_code=400,
                    detail="Exercise recording is empty.",
                )

            if uploaded_bytes > MAX_UPLOAD_BYTES:
                raise HTTPException(
                    status_code=413,
                    detail="Exercise recording exceeds the 50 MB limit.",
                )

            trace_summary = await run_in_threadpool(
                process_video_to_csv,
                str(video_path),
                str(trace_path),
            )
            _validate_trace_summary(trace_summary)
            error, score = await run_in_threadpool(
                _score_trace,
                loaded_model,
                trace_path,
            )
    except HTTPException:
        raise
    except (TracePreprocessingError, VideoProcessingError) as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail="Exercise evaluation failed unexpectedly.",
        ) from error

    return {
        "success": True,
        "message": "Evaluation completed successfully.",
        "evaluationId": evaluation_id,
        "error": error,
        "score": score,
    }
