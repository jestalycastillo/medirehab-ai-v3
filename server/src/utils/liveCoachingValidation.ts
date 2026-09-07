import { HttpError } from "./httpError";

export type LiveCoachingEvent = "issue_resolved" | "repetition_completed";

export type ValidatedLiveCoachingInput = {
    event: LiveCoachingEvent;
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

    return { event: body.event as LiveCoachingEvent };
};
