import {
    getRequiredExerciseKeyPointVisibility,
    REQUIRED_VISIBILITY,
    type ExerciseKeyPointVisibility,
} from "./exercise-key-points";
import type { PoseLandmarkMap, PosePoint, PoseWorldLandmarkMap, UpperBodyLandmarks } from "./pose-landmarker.types";
import { classifyShoulderMovementDirection, type ShoulderMovementDirection } from "./shoulder-movement-direction";

export type ShoulderFlexionPhase =
    | "positioning"
    | "ready"
    | "raising"
    | "top"
    | "lowering";

export interface ShoulderFlexionGuidanceState {
    phase: ShoulderFlexionPhase;
    repetitions: number;
    consecutiveDownFrames: number;
    consecutiveTopFrames: number;
    activeIssue: ShoulderFlexionGuidanceIssue | null;
    candidateIssue: ShoulderFlexionGuidanceIssue | null;
    candidateIssueFrames: number;
    absentIssueFrames: number;
    recentGuidanceEvents: ShoulderFlexionGuidanceEvent[];
}

export type ShoulderFlexionGuidanceIssueId =
    | "target-arm-low"
    | "target-arm-high"
    | "other-arm-moving"
    | "target-arm-direction"
    | "direction-uncertain";

export interface ShoulderFlexionGuidanceIssue {
    id: ShoulderFlexionGuidanceIssueId;
    instruction: string;
}

export interface ShoulderFlexionGuidanceEvent {
    type: "issue_started" | "issue_resolved" | "repetition_completed";
    issue?: ShoulderFlexionGuidanceIssue;
    repetitionCount?: number;
}

export interface ShoulderFlexionGuidanceSnapshot {
    state: ShoulderFlexionGuidanceState;
    message: string;
    hasReliablePose: boolean;
    justCompletedRepetition: boolean;
    keyPoints: ExerciseKeyPointVisibility[];
    activeIssues: ShoulderFlexionGuidanceIssue[];
    resolvedIssues: ShoulderFlexionGuidanceIssue[];
    recentGuidanceEvents: ShoulderFlexionGuidanceEvent[];
}

const REQUIRED_CONSECUTIVE_FRAMES = 2;
const REQUIRED_ISSUE_CONSECUTIVE_FRAMES = 2;
const MAX_RECENT_GUIDANCE_EVENTS = 3;
const SHOULDER_HEIGHT_LOW_THRESHOLD = 0.35;
const SHOULDER_HEIGHT_HIGH_THRESHOLD = -0.35;
const SHOULDER_FLEXION_EXERCISE_NAME = "Shoulder Flexion";

export const INITIAL_SHOULDER_FLEXION_STATE: ShoulderFlexionGuidanceState = {
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

export function supportsShoulderFlexionGuidance(exerciseName: string): boolean {
    const normalized = exerciseName.trim().toLowerCase().replaceAll(/[-_]+/g, " ");
    return normalized.includes("flexion") || normalized === "shoulder flexion";
}

export function updateShoulderFlexionGuidance(
    previous: ShoulderFlexionGuidanceState,
    landmarks: PoseLandmarkMap | null,
    side: "left" | "right" = "left",
    worldLandmarks: PoseWorldLandmarkMap | null = null,
): ShoulderFlexionGuidanceSnapshot {
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
                SHOULDER_FLEXION_EXERCISE_NAME,
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
                SHOULDER_FLEXION_EXERCISE_NAME,
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
    const consecutiveTopFrames = targetArmAtShoulderHeight && direction === "forward"
        ? Math.min(previous.consecutiveTopFrames + 1, REQUIRED_CONSECUTIVE_FRAMES)
        : 0;
    const confirmedDown = consecutiveDownFrames === REQUIRED_CONSECUTIVE_FRAMES;
    const confirmedTop = consecutiveTopFrames === REQUIRED_CONSECUTIVE_FRAMES;

    let phase = previous.phase;
    let repetitions = previous.repetitions;
    let justCompletedRepetition = false;

    if (targetArmAtShoulderHeight && direction !== "forward"
        && (phase === "top" || phase === "lowering")) {
        phase = "raising";
    }

    switch (phase) {
        case "positioning":
            if (confirmedDown) phase = "ready";
            break;
        case "ready":
            if (confirmedTop) phase = "top";
            else if (!targetArmDown) phase = "raising";
            break;
        case "raising":
            if (confirmedTop) phase = "top";
            else if (confirmedDown) phase = "ready";
            break;
        case "top":
            if (confirmedDown) {
                phase = "ready";
                repetitions += 1;
                justCompletedRepetition = true;
            } else if (!targetArmAtShoulderHeight) {
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

    const baseState = {
        phase,
        repetitions,
        consecutiveDownFrames,
        consecutiveTopFrames,
    };
    const correctionIssue = correctiveGuidanceIssue(
        baseState,
        targetDrop,
        otherDrop,
        otherElbow.visibility >= REQUIRED_VISIBILITY,
        targetArmAtShoulderHeight ? direction : null,
        sideLabel,
        otherLabel,
    );
    const verifiedIssues = updateVerifiedIssues(previous, correctionIssue);
    const guidanceEvents = [
        ...verifiedIssues.events,
        ...(justCompletedRepetition
            ? [{ type: "repetition_completed" as const, repetitionCount: repetitions }]
            : []),
    ];
    const state: ShoulderFlexionGuidanceState = {
        ...baseState,
        ...verifiedIssues.state,
        recentGuidanceEvents: appendRecentEvents(
            previous.recentGuidanceEvents,
            guidanceEvents,
        ),
    };

    return {
        state,
        message: justCompletedRepetition
            ? guidanceMessage(state, sideLabel, justCompletedRepetition)
            : correctionIssue?.instruction ?? guidanceMessage(state, sideLabel, justCompletedRepetition),
        hasReliablePose: true,
        justCompletedRepetition,
        keyPoints: getRequiredExerciseKeyPointVisibility(
            SHOULDER_FLEXION_EXERCISE_NAME,
            landmarks,
            REQUIRED_VISIBILITY,
            side,
        ),
        activeIssues: state.activeIssue ? [state.activeIssue] : [],
        resolvedIssues: verifiedIssues.resolvedIssues,
        recentGuidanceEvents: state.recentGuidanceEvents,
    };
}

function hasReliableUpperBodyLandmarks(landmarks: UpperBodyLandmarks, side: "left" | "right"): boolean {
    const required = [
        landmarks.leftShoulder,
        landmarks.rightShoulder,
        side === "left" ? landmarks.leftElbow : landmarks.rightElbow,
    ];
    return required.every((point) => point.visibility >= REQUIRED_VISIBILITY);
}

function toUpperBodyLandmarks(landmarks: PoseLandmarkMap | null): UpperBodyLandmarks | null {
    const leftShoulder = landmarks?.leftShoulder;
    const rightShoulder = landmarks?.rightShoulder;
    const leftElbow = landmarks?.leftElbow;
    const rightElbow = landmarks?.rightElbow;

    if (
        !isPosePoint(leftShoulder)
        || !isPosePoint(rightShoulder)
        || !isPosePoint(leftElbow)
        || !isPosePoint(rightElbow)
    ) {
        return null;
    }

    return {
        leftShoulder,
        rightShoulder,
        leftElbow,
        rightElbow,
    };
}

function isPosePoint(point: PosePoint | undefined): point is PosePoint {
    return Boolean(point);
}

function distance(a: { x: number; y: number }, b: { x: number; y: number }): number {
    return Math.hypot(a.x - b.x, a.y - b.y);
}

function guidanceMessage(
    state: ShoulderFlexionGuidanceState,
    sideLabel: string,
    justCompletedRepetition: boolean,
): string {
    if (justCompletedRepetition) {
        return `Repetition ${state.repetitions} complete. Raise your ${sideLabel} arm when ready.`;
    }

    switch (state.phase) {
        case "positioning":
            return `Start with your ${sideLabel} arm comfortably down at your side.`;
        case "ready":
            return `Raise your ${sideLabel} arm forward to shoulder height.`;
        case "raising":
            return `Continue raising your ${sideLabel} arm toward shoulder height.`;
        case "top":
            return `Shoulder height reached. Lower your ${sideLabel} arm slowly.`;
        case "lowering":
            return `Continue lowering your ${sideLabel} arm in a controlled motion.`;
    }
}

function correctiveGuidanceIssue(
    state: Pick<ShoulderFlexionGuidanceState, "phase">,
    targetDrop: number,
    otherDrop: number,
    otherArmVisible: boolean,
    direction: ShoulderMovementDirection | null,
    sideLabel: string,
    otherLabel: string,
): ShoulderFlexionGuidanceIssue | null {
    if (state.phase !== "raising" && state.phase !== "top") {
        return null;
    }

    if (direction === "sideways") {
        return {
            id: "target-arm-direction",
            instruction: `Move your ${sideLabel} arm forward, not out to the side.`,
        };
    }
    if (direction === "uncertain") {
        return {
            id: "direction-uncertain",
            instruction: `Keep facing the camera so we can check your ${sideLabel} arm moves forward.`,
        };
    }

    if (otherArmVisible && otherDrop < 0.25 && targetDrop > 0.35) {
        return {
            id: "other-arm-moving",
            instruction: `Keep your ${otherLabel} arm relaxed down and raise your ${sideLabel} arm.`,
        };
    }

    if (state.phase === "top") {
        if (targetDrop > SHOULDER_HEIGHT_LOW_THRESHOLD) {
            return {
                id: "target-arm-low",
                instruction: `Raise your ${sideLabel} arm a little higher to shoulder height.`,
            };
        }

        if (targetDrop < SHOULDER_HEIGHT_HIGH_THRESHOLD) {
            return {
                id: "target-arm-high",
                instruction: `Lower your ${sideLabel} arm slightly back to shoulder height.`,
            };
        }
    }

    return null;
}

function updateVerifiedIssues(
    previous: ShoulderFlexionGuidanceState,
    candidateIssue: ShoulderFlexionGuidanceIssue | null,
): {
    state: Pick<
        ShoulderFlexionGuidanceState,
        "activeIssue" | "candidateIssue" | "candidateIssueFrames" | "absentIssueFrames"
    >;
    resolvedIssues: ShoulderFlexionGuidanceIssue[];
    events: ShoulderFlexionGuidanceEvent[];
} {
    const candidateMatchesPrevious =
        candidateIssue?.id === previous.candidateIssue?.id;
    const candidateIssueFrames = candidateIssue
        ? candidateMatchesPrevious
            ? previous.candidateIssueFrames + 1
            : 1
        : 0;
    const activeIssueIsPresent = candidateIssue?.id === previous.activeIssue?.id;
    const absentIssueFrames = previous.activeIssue
        ? activeIssueIsPresent
            ? 0
            : previous.absentIssueFrames + 1
        : 0;
    const resolvedIssues =
        previous.activeIssue && absentIssueFrames >= REQUIRED_ISSUE_CONSECUTIVE_FRAMES
            ? [previous.activeIssue]
            : [];
    const activeIssue = resolvedIssues.length > 0 ? null : previous.activeIssue;
    const canStartCandidate =
        !activeIssue &&
        candidateIssue &&
        candidateIssueFrames >= REQUIRED_ISSUE_CONSECUTIVE_FRAMES;
    const nextActiveIssue = canStartCandidate ? candidateIssue : activeIssue;
    const startedIssue =
        canStartCandidate && previous.activeIssue?.id !== candidateIssue?.id
            ? candidateIssue
            : null;
    const events: ShoulderFlexionGuidanceEvent[] = [
        ...resolvedIssues.map((issue) => ({ type: "issue_resolved" as const, issue })),
        ...(startedIssue ? [{ type: "issue_started" as const, issue: startedIssue }] : []),
    ];

    return {
        state: {
            activeIssue: nextActiveIssue,
            candidateIssue,
            candidateIssueFrames,
            absentIssueFrames:
                nextActiveIssue?.id === candidateIssue?.id ? 0 : absentIssueFrames,
        },
        resolvedIssues,
        events,
    };
}

function appendRecentEvents(
    previousEvents: ShoulderFlexionGuidanceEvent[],
    newEvents: ShoulderFlexionGuidanceEvent[],
): ShoulderFlexionGuidanceEvent[] {
    return [...previousEvents, ...newEvents].slice(-MAX_RECENT_GUIDANCE_EVENTS);
}
