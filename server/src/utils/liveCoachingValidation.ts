import { HttpError } from "./httpError";

export type LiveCoachingEvent = "issue_resolved" | "repetition_completed";
export type LiveCoachingSide = "left" | "right";

export type ValidatedLiveCoachingInput = {
    event: LiveCoachingEvent;
    side?: LiveCoachingSide;
    issueType?: string;
};

const LIVE_COACHING_EVENTS = new Set<LiveCoachingEvent>([
    "issue_resolved",
    "repetition_completed"
]);

export const validateLiveCoachingInput = (
    body: Record<string, unknown>
): ValidatedLiveCoachingInput => {
    if (typeof body.event !== "string" || !LIVE_COACHING_EVENTS.has(body.event as LiveCoachingEvent)) {
        throw new HttpError(400, "Live coaching event is invalid.");
    }

    const side = body.side === "left" || body.side === "right" ? body.side : undefined;
    const issueType = typeof body.issueType === "string" ? body.issueType.trim() : undefined;

    return {
        event: body.event as LiveCoachingEvent,
        ...(side ? { side } : {}),
        ...(issueType ? { issueType } : {})
    };
};
