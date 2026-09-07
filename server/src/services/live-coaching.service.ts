import { prisma } from "../lib/prisma";
import { HttpError } from "../utils/httpError";
import type { LiveCoachingEvent } from "../utils/liveCoachingValidation";

const DEFAULT_AI_SERVICE_BASE_URL = "http://127.0.0.1:8000";
const LIVE_COACHING_TIMEOUT_MS = 5_000;

type AiServiceCoachingResponse = {
    success?: unknown;
    message?: unknown;
    source?: unknown;
};

const fallbackForEvent = (event: LiveCoachingEvent): string => {
    switch (event) {
        case "issue_resolved":
            return "Nice adjustment. Keep moving with steady control.";
        case "repetition_completed":
            return "Great control on that repetition. Keep the pace smooth.";
    }
};

const getAiServiceBaseUrl = (): string => {
    const configuredUrl = process.env.AI_SERVICE_URL?.trim() || DEFAULT_AI_SERVICE_BASE_URL;

    try {
        return new URL(configuredUrl).toString().replace(/\/$/, "");
    } catch {
        throw new HttpError(503, "Live coaching service is not configured correctly.");
    }
};

const requestCoachingMessage = async (
    exerciseName: string,
    event: LiveCoachingEvent
): Promise<{ message: string; source: "ollama" | "fallback" } | null> => {
    const abortController = new AbortController();
    const timeout = setTimeout(() => abortController.abort(), LIVE_COACHING_TIMEOUT_MS);

    try {
        const response = await fetch(`${getAiServiceBaseUrl()}/coaching`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            signal: abortController.signal,
            body: JSON.stringify({
                exercise_name: exerciseName,
                event,
            }),
        });

        if (!response.ok) return null;

        const payload = await response.json() as AiServiceCoachingResponse;
        if (
            payload.success !== true
            || typeof payload.message !== "string"
            || (payload.source !== "ollama" && payload.source !== "fallback")
        ) {
            return null;
        }

        return { message: payload.message, source: payload.source };
    } catch {
        return null;
    } finally {
        clearTimeout(timeout);
    }
};

export const createLiveCoachingMessage = async (
    patientUserId: string,
    exerciseId: string,
    assignmentId: string,
    event: LiveCoachingEvent
): Promise<{ message: string; source: "ollama" | "fallback" }> => {
    const assignment = await prisma.exerciseAssignment.findFirst({
        where: {
            id: assignmentId,
            exerciseId,
            archivedAt: null,
            patientProfile: { is: { userId: patientUserId } },
            exercise: { is: { isActive: true, archivedAt: null } },
        },
        select: { exercise: { select: { name: true } } },
    });

    if (!assignment) {
        throw new HttpError(404, "Assigned exercise not found.");
    }

    const coaching = await requestCoachingMessage(assignment.exercise.name, event);
    return coaching ?? { message: fallbackForEvent(event), source: "fallback" };
};
