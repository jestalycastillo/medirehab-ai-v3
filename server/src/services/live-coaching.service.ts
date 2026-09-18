import { prisma } from "../lib/prisma";
import { HttpError } from "../utils/httpError";
import type { LiveCoachingEvent, LiveCoachingSide } from "../utils/liveCoachingValidation";

const DEFAULT_AI_SERVICE_BASE_URL = "http://127.0.0.1:8000";
const DEFAULT_AI_SERVICE_TIMEOUT_MS = 120_000;

type AiServiceCoachingResponse = {
    success?: unknown;
    message?: unknown;
    source?: unknown;
};

const fallbackForEvent = (event: LiveCoachingEvent, side?: LiveCoachingSide, issueType?: string): string => {
    const sideContext = side ? ` on your ${side} arm` : "";
    if (issueType === "torso-leaning" || issueType === "chest-compensation" || issueType === "chest-sway" || issueType === "posture") {
        return "Great posture adjustment. Keeping your chest steady helps isolate the shoulder.";
    }
    switch (event) {
        case "issue_resolved":
            return `Nice adjustment${sideContext}. Keep moving with steady control.`;
        case "repetition_completed":
            return `Great control on that repetition${sideContext}. Keep the pace smooth.`;
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

const getAiServiceTimeoutMs = (): number => {
    const configuredTimeout = process.env.AI_SERVICE_TIMEOUT_MS?.trim();

    if (!configuredTimeout) {
        return DEFAULT_AI_SERVICE_TIMEOUT_MS;
    }

    const timeoutMs = Number(configuredTimeout);

    if (!Number.isInteger(timeoutMs) || timeoutMs < 1_000 || timeoutMs > 600_000) {
        throw new HttpError(503, "Live coaching timeout is not configured correctly.");
    }

    return timeoutMs;
};

const requestCoachingMessage = async (
    exerciseName: string,
    event: LiveCoachingEvent,
    side?: LiveCoachingSide,
    issueType?: string
): Promise<{ message: string; source: "ollama" | "fallback" } | null> => {
    const abortController = new AbortController();
    const timeout = setTimeout(() => abortController.abort(), getAiServiceTimeoutMs());

    try {
        const fullExerciseName = side
            ? `${exerciseName} (${side === "left" ? "Left" : "Right"} Arm)`
            : exerciseName;

        const response = await fetch(`${getAiServiceBaseUrl()}/coaching`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            signal: abortController.signal,
            body: JSON.stringify({
                exercise_name: fullExerciseName,
                event,
                side,
                issue_type: issueType,
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
    event: LiveCoachingEvent,
    side?: LiveCoachingSide,
    issueType?: string
): Promise<{ message: string; source: "ollama" | "fallback" }> => {
    let exerciseName = "Shoulder Flexion";

    const assignment = await prisma.exerciseAssignment.findFirst({
        where: {
            id: assignmentId,
            patientProfile: { is: { userId: patientUserId } },
        },
        select: { exercise: { select: { name: true } } },
    });

    if (assignment?.exercise?.name) {
        exerciseName = assignment.exercise.name;
    } else {
        const exercise = await prisma.exercise.findUnique({
            where: { id: exerciseId },
            select: { name: true }
        });
        if (exercise?.name) {
            exerciseName = exercise.name;
        }
    }

    const coaching = await requestCoachingMessage(exerciseName, event, side, issueType);
    return coaching ?? { message: fallbackForEvent(event, side, issueType), source: "fallback" };
};
