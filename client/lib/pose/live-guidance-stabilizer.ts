export const GUIDANCE_STABILITY_MS = 700;
export const GUIDANCE_MIN_DISPLAY_MS = 1_600;

export interface GuidanceDisplayState {
    displayedMessage: string;
    displayedSince: number;
    candidateMessage: string | null;
    candidateSince: number | null;
}

export const INITIAL_GUIDANCE_DISPLAY_STATE: GuidanceDisplayState = {
    displayedMessage: "",
    displayedSince: 0,
    candidateMessage: null,
    candidateSince: null,
};

export function stabilizeGuidanceMessage(
    previous: GuidanceDisplayState,
    message: string,
    now: number,
    isUrgent = false,
): GuidanceDisplayState {
    if (!message || isUrgent || !previous.displayedMessage) {
        return {
            displayedMessage: message,
            displayedSince: now,
            candidateMessage: null,
            candidateSince: null,
        };
    }

    if (message === previous.displayedMessage) {
        return {
            ...previous,
            candidateMessage: null,
            candidateSince: null,
        };
    }

    const isNewCandidate = message !== previous.candidateMessage;
    const candidateSince = isNewCandidate ? now : previous.candidateSince ?? now;
    const candidateIsStable = now - candidateSince >= GUIDANCE_STABILITY_MS;
    const currentMessageHasBeenVisible =
        now - previous.displayedSince >= GUIDANCE_MIN_DISPLAY_MS;

    if (candidateIsStable && currentMessageHasBeenVisible) {
        return {
            displayedMessage: message,
            displayedSince: now,
            candidateMessage: null,
            candidateSince: null,
        };
    }

    return {
        ...previous,
        candidateMessage: message,
        candidateSince,
    };
}
