import {
    getRequiredExerciseKeyPointVisibility,
    REQUIRED_VISIBILITY,
    type ExerciseKeyPointVisibility,
} from "./exercise-key-points";
import type { PoseLandmarkMap, PosePoint, PoseWorldLandmarkMap, UpperBodyLandmarks } from "./pose-landmarker.types";
import { classifyShoulderMovementDirection, type ShoulderMovementDirection } from "./shoulder-movement-direction";

export type ShoulderAbductionPhase =
    | "positioning"
    | "ready"
    | "raising"
    | "top"
    | "lowering";

export interface ShoulderAbductionGuidanceState {
    phase: ShoulderAbductionPhase;
    repetitions: number;
    consecutiveDownFrames: number;
    consecutiveTopFrames: number;
    activeIssue: ShoulderAbductionGuidanceIssue | null;
    candidateIssue: ShoulderAbductionGuidanceIssue | null;
    candidateIssueFrames: number;
    absentIssueFrames: number;
    recentGuidanceEvents: ShoulderAbductionGuidanceEvent[];
}

export type ShoulderAbductionGuidanceIssueId =
    | "target-arm-low"
    | "target-arm-high"
    | "other-arm-moving"
    | "target-arm-direction"
    | "direction-uncertain"
    | "torso-leaning"
    | "chest-sway";

export interface ShoulderAbductionGuidanceIssue {
    id: ShoulderAbductionGuidanceIssueId;
    instruction: string;
}

export interface ShoulderAbductionGuidanceEvent {
    type: "issue_started" | "issue_resolved" | "repetition_completed";
    issue?: ShoulderAbductionGuidanceIssue;
    repetitionCount?: number;
}

export interface ShoulderAbductionGuidanceSnapshot {
    state: ShoulderAbductionGuidanceState;
    message: string;
    hasReliablePose: boolean;
    justCompletedRepetition: boolean;
    keyPoints: ExerciseKeyPointVisibility[];
    activeIssues: ShoulderAbductionGuidanceIssue[];
    resolvedIssues: ShoulderAbductionGuidanceIssue[];
    recentGuidanceEvents: ShoulderAbductionGuidanceEvent[];
}

const REQUIRED_CONSECUTIVE_FRAMES = 2;
const REQUIRED_ISSUE_CONSECUTIVE_FRAMES = 2;
const MAX_RECENT_GUIDANCE_EVENTS = 3;
const SHOULDER_HEIGHT_LOW_THRESHOLD = 0.35;
const SHOULDER_HEIGHT_HIGH_THRESHOLD = -0.35;
const SHOULDER_ABDUCTION_EXERCISE_NAME = "Shoulder Abduction";

export const INITIAL_SHOULDER_ABDUCTION_STATE: ShoulderAbductionGuidanceState = {
    phase: "positioning",
    repetitions: 0,
    consecutiveDownFrames: 0,
    consecutiveTopFrames: 0,
    activeIssue: null,
    candidateIssue: null,
    candidateIssueFrames: 0,
    absentIssueFrames: 0,
    recentGuidanceEvents: [],
};

export function supportsShoulderAbductionGuidance(exerciseName: string): boolean {
    const normalized = exerciseName.trim().toLowerCase().replaceAll(/[-_]+/g, " ");
    return normalized.includes("abduction") || normalized === "shoulder abduction";
}

export function updateShoulderAbductionGuidance(
    previous: ShoulderAbductionGuidanceState,
    landmarks: PoseLandmarkMap | null,
    side: "left" | "right" = "left",
    worldLandmarks: PoseWorldLandmarkMap | null = null,
): ShoulderAbductionGuidanceSnapshot {
    const upperBodyLandmarks = toUpperBodyLandmarks(landmarks);
    const sideLabel = side === "left" ? "left" : "right";
    const otherLabel = side === "left" ? "right" : "left";

    if (!upperBodyLandmarks || !hasReliableUpperBodyLandmarks(upperBodyLandmarks, side)) {
        return {
            state: {
                ...previous,
                consecutiveDownFrames: 0,
                consecutiveTopFrames: 0,
            },
            message: `Move fully into the frame so your shoulders and ${sideLabel} arm are visible.`,
            hasReliablePose: false,
            justCompletedRepetition: false,
            keyPoints: getRequiredExerciseKeyPointVisibility(
                SHOULDER_ABDUCTION_EXERCISE_NAME,
                landmarks,
                REQUIRED_VISIBILITY,
                side,
            ),
            activeIssues: [],
            resolvedIssues: [],
            recentGuidanceEvents: previous.recentGuidanceEvents,
        };
    }

    const shoulderWidth = distance(upperBodyLandmarks.leftShoulder, upperBodyLandmarks.rightShoulder);
    if (shoulderWidth < 0.05) {
        return {
            state: {
                ...previous,
                consecutiveDownFrames: 0,
                consecutiveTopFrames: 0,
            },
            message: "Face the camera and keep both shoulders visible.",
            hasReliablePose: false,
            justCompletedRepetition: false,
            keyPoints: getRequiredExerciseKeyPointVisibility(
                SHOULDER_ABDUCTION_EXERCISE_NAME,
                landmarks,
                REQUIRED_VISIBILITY,
                side,
            ),
            activeIssues: [],
            resolvedIssues: [],
            recentGuidanceEvents: previous.recentGuidanceEvents,
        };
    }

    const targetElbow = side === "left" ? upperBodyLandmarks.leftElbow : upperBodyLandmarks.rightElbow;
    const targetShoulder = side === "left" ? upperBodyLandmarks.leftShoulder : upperBodyLandmarks.rightShoulder;
    const otherElbow = side === "left" ? upperBodyLandmarks.rightElbow : upperBodyLandmarks.leftElbow;
    const otherShoulder = side === "left" ? upperBodyLandmarks.rightShoulder : upperBodyLandmarks.leftShoulder;

    const targetDrop = (targetElbow.y - targetShoulder.y) / shoulderWidth;
    const otherDrop = (otherElbow.y - otherShoulder.y) / shoulderWidth;

    const targetArmDown = targetDrop > 0.42;
    const targetArmAtShoulderHeight = Math.abs(targetDrop) < 0.32;
    const otherArmQuiet = otherElbow.visibility < REQUIRED_VISIBILITY || otherDrop > 0.38;
    const direction = classifyShoulderMovementDirection(worldLandmarks, side);

    const consecutiveDownFrames = (targetArmDown && otherArmQuiet)
        ? Math.min(previous.consecutiveDownFrames + 1, REQUIRED_CONSECUTIVE_FRAMES)
        : 0;
    const consecutiveTopFrames = targetArmAtShoulderHeight && direction === "sideways"
        ? Math.min(previous.consecutiveTopFrames + 1, REQUIRED_CONSECUTIVE_FRAMES)
        : 0;
    const confirmedDown = consecutiveDownFrames === REQUIRED_CONSECUTIVE_FRAMES;
    const confirmedTop = consecutiveTopFrames === REQUIRED_CONSECUTIVE_FRAMES;

    let phase = previous.phase;
    let repetitions = previous.repetitions;
    let justCompletedRepetition = false;

    if (targetArmAtShoulderHeight && direction !== "sideways"
        && (phase === "top" || phase === "lowering")) {
        phase = "raising";
    }

    switch (phase) {
        case "positioning":
            if (confirmedDown) phase = "ready";
            break;
        case "ready":
            if (!targetArmDown) phase = "raising";
            break;
        case "raising":
            if (confirmedTop) {
                phase = "top";
            } else if (confirmedDown) {
                phase = "ready";
            }
            break;
        case "top":
            if (!targetArmAtShoulderHeight) {
                phase = "lowering";
            }
            break;
        case "lowering":
            if (confirmedDown) {
                phase = "ready";
                repetitions += 1;
                justCompletedRepetition = true;
            } else if (confirmedTop) {
                phase = "top";
            }
            break;
    }

    const candidateIssue = detectCandidateIssue(
        upperBodyLandmarks,
        shoulderWidth,
        targetArmAtShoulderHeight ? direction : null,
        phase,
        side,
        sideLabel,
        otherLabel,
    );

    const {
        activeIssue,
        candidateIssue: nextCandidateIssue,
        candidateIssueFrames,
        absentIssueFrames,
        resolvedIssues,
        events: issueEvents,
    } = updateIssueLifecycle(
        previous,
        candidateIssue,
        phase,
    );

    const allEvents = issueEvents.slice();
    if (justCompletedRepetition) {
        allEvents.push({
            type: "repetition_completed",
            repetitionCount: repetitions,
        });
    }

    const nextEvents = mergeRecentEvents(
        previous.recentGuidanceEvents,
        allEvents,
    );

    const message = deriveMessage(
        phase,
        activeIssue,
        justCompletedRepetition,
        sideLabel,
    );

    const state: ShoulderAbductionGuidanceState = {
        phase,
        repetitions,
        consecutiveDownFrames,
        consecutiveTopFrames,
        activeIssue,
        candidateIssue: nextCandidateIssue,
        candidateIssueFrames,
        absentIssueFrames,
        recentGuidanceEvents: nextEvents,
    };

    return {
        state,
        message,
        hasReliablePose: true,
        justCompletedRepetition,
        keyPoints: getRequiredExerciseKeyPointVisibility(
            SHOULDER_ABDUCTION_EXERCISE_NAME,
            landmarks,
            REQUIRED_VISIBILITY,
            side,
        ),
        activeIssues: activeIssue ? [activeIssue] : [],
        resolvedIssues,
        recentGuidanceEvents: nextEvents,
    };
}

function toUpperBodyLandmarks(landmarks: PoseLandmarkMap | null): UpperBodyLandmarks | null {
    if (!landmarks) return null;
    const { leftShoulder, rightShoulder, leftElbow, rightElbow } = landmarks;
    if (!leftShoulder || !rightShoulder || !leftElbow || !rightElbow) return null;
    const chest: PosePoint = landmarks.chest ?? {
        x: (leftShoulder.x + rightShoulder.x) / 2,
        y: (leftShoulder.y + rightShoulder.y) / 2,
        visibility: Math.min(leftShoulder.visibility, rightShoulder.visibility),
    };
    return { chest, leftShoulder, rightShoulder, leftElbow, rightElbow };
}

function hasReliableUpperBodyLandmarks(
    landmarks: UpperBodyLandmarks,
    side: "left" | "right",
): boolean {
    const minVisibility = REQUIRED_VISIBILITY;
    const targetElbow = side === "left" ? landmarks.leftElbow : landmarks.rightElbow;
    return (
        (landmarks.leftShoulder.visibility ?? 0) >= minVisibility &&
        (landmarks.rightShoulder.visibility ?? 0) >= minVisibility &&
        (targetElbow.visibility ?? 0) >= minVisibility
    );
}

function distance(a: PosePoint, b: PosePoint): number {
    return Math.hypot(a.x - b.x, a.y - b.y);
}

function deriveMessage(
    phase: ShoulderAbductionPhase,
    activeIssue: ShoulderAbductionGuidanceIssue | null,
    justCompletedRepetition: boolean,
    sideLabel: string,
): string {
    if (justCompletedRepetition) {
        return "Good repetition! Lower arm smoothly and prepare for the next rep.";
    }

    if (activeIssue) {
        return activeIssue.instruction;
    }

    switch (phase) {
        case "positioning":
            return `Stand with both arms resting comfortably. Focus on your ${sideLabel} arm.`;
        case "ready":
            return `Raise your ${sideLabel} arm outward to the side to shoulder height.`;
        case "raising":
            return `Continue lifting your ${sideLabel} arm out to shoulder level.`;
        case "top":
            return "Hold position at shoulder height.";
        case "lowering":
            return `Lower your ${sideLabel} arm smoothly back to your side.`;
    }
}

function detectCandidateIssue(
    landmarks: UpperBodyLandmarks,
    shoulderWidth: number,
    direction: ShoulderMovementDirection | null,
    phase: ShoulderAbductionPhase,
    side: "left" | "right",
    sideLabel: string,
    otherLabel: string,
): ShoulderAbductionGuidanceIssue | null {
    const shoulderTilt = Math.abs(landmarks.leftShoulder.y - landmarks.rightShoulder.y) / shoulderWidth;
    if (shoulderTilt > 0.22) {
        return {
            id: "torso-leaning",
            instruction: `Keep your chest upright and avoid leaning your torso.`,
        };
    }

    const targetElbow = side === "left" ? landmarks.leftElbow : landmarks.rightElbow;
    const targetShoulder = side === "left" ? landmarks.leftShoulder : landmarks.rightShoulder;
    const otherElbow = side === "left" ? landmarks.rightElbow : landmarks.leftElbow;
    const otherShoulder = side === "left" ? landmarks.rightShoulder : landmarks.leftShoulder;

    const otherDrop = (otherElbow.y - otherShoulder.y) / shoulderWidth;
    if (direction === "forward") {
        return {
            id: "target-arm-direction",
            instruction: `Move your ${sideLabel} arm out to the side, not forward.`,
        };
    }
    if (direction === "uncertain") {
        return {
            id: "direction-uncertain",
            instruction: `Keep facing the camera so we can check your ${sideLabel} arm moves sideways.`,
        };
    }
    if (otherElbow.visibility >= REQUIRED_VISIBILITY && otherDrop < 0.25) {
        return {
            id: "other-arm-moving",
            instruction: `Keep your ${otherLabel} arm relaxed while moving your ${sideLabel} arm.`,
        };
    }

    if (phase === "top") {
        const targetDrop = (targetElbow.y - targetShoulder.y) / shoulderWidth;
        if (targetDrop > SHOULDER_HEIGHT_LOW_THRESHOLD) {
            return {
                id: "target-arm-low",
                instruction: `Raise your ${sideLabel} arm higher to reach shoulder height.`,
            };
        }
        if (targetDrop < SHOULDER_HEIGHT_HIGH_THRESHOLD) {
            return {
                id: "target-arm-high",
                instruction: `Lower your ${sideLabel} arm slightly so it stays level with your shoulder.`,
            };
        }
    }

    return null;
}

function updateIssueLifecycle(
    previous: ShoulderAbductionGuidanceState,
    candidateIssue: ShoulderAbductionGuidanceIssue | null,
    phase: ShoulderAbductionPhase,
): {
    activeIssue: ShoulderAbductionGuidanceIssue | null;
    candidateIssue: ShoulderAbductionGuidanceIssue | null;
    candidateIssueFrames: number;
    absentIssueFrames: number;
    resolvedIssues: ShoulderAbductionGuidanceIssue[];
    events: ShoulderAbductionGuidanceEvent[];
} {
    let activeIssue = previous.activeIssue;
    let nextCandidate = previous.candidateIssue;
    let candidateFrames = previous.candidateIssueFrames;
    let absentFrames = previous.absentIssueFrames;
    const resolvedIssues: ShoulderAbductionGuidanceIssue[] = [];
    const events: ShoulderAbductionGuidanceEvent[] = [];

    if (phase === "positioning" || phase === "ready") {
        if (activeIssue) {
            resolvedIssues.push(activeIssue);
            events.push({ type: "issue_resolved", issue: activeIssue });
        }
        return {
            activeIssue: null,
            candidateIssue: null,
            candidateIssueFrames: 0,
            absentIssueFrames: 0,
            resolvedIssues,
            events,
        };
    }

    if (candidateIssue) {
        absentFrames = 0;
        if (nextCandidate?.id === candidateIssue.id) {
            candidateFrames += 1;
        } else {
            nextCandidate = candidateIssue;
            candidateFrames = 1;
        }

        if (candidateFrames >= REQUIRED_ISSUE_CONSECUTIVE_FRAMES) {
            if (activeIssue?.id !== candidateIssue.id) {
                activeIssue = candidateIssue;
                events.push({ type: "issue_started", issue: candidateIssue });
            }
        }
    } else {
        candidateFrames = 0;
        nextCandidate = null;
        if (activeIssue) {
            absentFrames += 1;
            if (absentFrames >= REQUIRED_ISSUE_CONSECUTIVE_FRAMES) {
                resolvedIssues.push(activeIssue);
                events.push({ type: "issue_resolved", issue: activeIssue });
                activeIssue = null;
                absentFrames = 0;
            }
        }
    }

    return {
        activeIssue,
        candidateIssue: nextCandidate,
        candidateIssueFrames: candidateFrames,
        absentIssueFrames: absentFrames,
        resolvedIssues,
        events,
    };
}

function mergeRecentEvents(
    previousEvents: ShoulderAbductionGuidanceEvent[],
    newEvents: ShoulderAbductionGuidanceEvent[],
): ShoulderAbductionGuidanceEvent[] {
    if (newEvents.length === 0) return previousEvents;
    return [...previousEvents, ...newEvents].slice(-MAX_RECENT_GUIDANCE_EVENTS);
}
