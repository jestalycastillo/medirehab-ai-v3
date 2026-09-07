import os
import re
from typing import Literal

import httpx
from fastapi import APIRouter
from pydantic import BaseModel, Field

router = APIRouter(
    prefix="/coaching",
    tags=["coaching"],
)

DEFAULT_OLLAMA_BASE_URL = "http://127.0.0.1:11434"
DEFAULT_OLLAMA_MODEL = "coach-qwen:latest"
DEFAULT_OLLAMA_TIMEOUT_MS = 5_000
DEFAULT_OLLAMA_KEEP_ALIVE = "10m"
MAX_COACHING_WORDS = 10
DISALLOWED_COACHING_WORDS = re.compile(
    r"\b(?:complete|completed|finish|finished|done|pain|dizzy|dizziness|medical|doctor|error|left|right|arm|shoulder|elbow|wrist|push|hard|stronger|force|intense|intensity|faster|higher|lower|further|goals?)\b",
    re.IGNORECASE,
)

COACH_SYSTEM_PROMPT = " ".join(
    [
        "You are a warm, short exercise coach.",
        "Return exactly one encouragement sentence, maximum 10 words.",
        "Never give movement directions.",
        "Never mention body parts, errors, corrections, completion, pain, or medical advice.",
        "Never encourage intensity, force, pushing harder, or faster movement.",
        "Use only the verified praise. Return only the sentence.",
    ]
)


class LiveCoachingRequest(BaseModel):
    exercise_name: str = Field(min_length=1, max_length=120)
    event: Literal["issue_resolved", "repetition_completed"]


def _praise_for_event(event: str) -> str:
    if event == "issue_resolved":
        return "The patient corrected a movement issue."
    return "The patient completed a controlled repetition."


def _fallback_for_event(event: str) -> str:
    if event == "issue_resolved":
        return "Nice adjustment. Keep moving with steady control."
    return "Great control on that repetition. Keep the pace smooth."


def _ollama_base_url() -> str:
    return os.getenv("OLLAMA_BASE_URL", DEFAULT_OLLAMA_BASE_URL).rstrip("/")


def _ollama_timeout_seconds() -> float:
    try:
        timeout_ms = int(os.getenv("OLLAMA_TIMEOUT_MS", str(DEFAULT_OLLAMA_TIMEOUT_MS)))
    except ValueError:
        return DEFAULT_OLLAMA_TIMEOUT_MS / 1_000

    if timeout_ms < 1_000 or timeout_ms > 30_000:
        return DEFAULT_OLLAMA_TIMEOUT_MS / 1_000
    return timeout_ms / 1_000


def _is_safe_coaching_message(message: str) -> bool:
    words = [word for word in message.split() if word]
    return (
        0 < len(words) <= MAX_COACHING_WORDS
        and DISALLOWED_COACHING_WORDS.search(message) is None
    )


async def _request_coaching_message(request: LiveCoachingRequest) -> str | None:
    payload = {
        "model": os.getenv("OLLAMA_MODEL", DEFAULT_OLLAMA_MODEL),
        "stream": False,
        "think": False,
        "keep_alive": os.getenv("OLLAMA_KEEP_ALIVE", DEFAULT_OLLAMA_KEEP_ALIVE),
        "options": {"temperature": 0.2, "num_predict": 24},
        "messages": [
            {"role": "system", "content": COACH_SYSTEM_PROMPT},
            {
                "role": "user",
                "content": (
                    f"Exercise: {request.exercise_name}\n"
                    f"Verified praise: {_praise_for_event(request.event)}"
                ),
            },
        ],
    }

    try:
        async with httpx.AsyncClient(timeout=_ollama_timeout_seconds()) as client:
            response = await client.post(f"{_ollama_base_url()}/api/chat", json=payload)
        if response.is_error:
            return None

        content = response.json().get("message", {}).get("content")
        if not isinstance(content, str):
            return None

        message = " ".join(content.split())
        return message if _is_safe_coaching_message(message) else None
    except (httpx.HTTPError, ValueError):
        return None


@router.post("")
async def create_live_coaching(request: LiveCoachingRequest):
    message = await _request_coaching_message(request)
    if message:
        return {"success": True, "message": message, "source": "ollama"}

    return {
        "success": True,
        "message": _fallback_for_event(request.event),
        "source": "fallback",
    }
