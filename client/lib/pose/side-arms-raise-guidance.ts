import {
    getRequiredExerciseKeyPointVisibility,
    REQUIRED_VISIBILITY,
    type ExerciseKeyPointVisibility,
} from "./exercise-key-points";
import type { PoseLandmarkMap, PosePoint, UpperBodyLandmarks } from "./pose-landmarker.types";

export type SideArmsRaisePhase =
    | "positioning"
    | "ready"
    | "raising"
    | "top"
    | "lowering";

export interface SideArmsRaiseGuidanceState {
    phase: SideArmsRaisePhase;
    repetitions: number;
    consecutiveDownFrames: number;
    consecutiveTopFrames: number;
    activeIssue: SideArmsRaiseGuidanceIssue | null;
    candidateIssue: SideArmsRaiseGuidanceIssue | null;
    candidateIssueFrames: number;
    absentIssueFrames: number;
    recentGuidanceEvents: SideArmsRaiseGuidanceEvent[];
}

export type SideArmsRaiseGuidanceIssueId =
    | "both-arms-reach"
    | "left-arm-reach"
    | "right-arm-reach"
    | "left-arm-height"
    | "right-arm-height"
    | "both-arms-low"
    | "left-arm-low"
    | "right-arm-low"
    | "both-arms-high"
    | "left-arm-high"
    | "right-arm-high";

export interface SideArmsRaiseGuidanceIssue {
    id: SideArmsRaiseGuidanceIssueId;
    instruction: string;
}

export interface SideArmsRaiseGuidanceEvent {
    type: "issue_started" | "issue_resolved" | "repetition_completed";
    issue?: SideArmsRaiseGuidanceIssue;
    repetitionCount?: number;
}

export interface SideArmsRaiseGuidanceSnapshot {
    state: SideArmsRaiseGuidanceState;
    message: string;
    hasReliablePose: boolean;
    justCompletedRepetition: boolean;
    keyPoints: ExerciseKeyPointVisibility[];
    activeIssues: SideArmsRaiseGuidanceIssue[];
    resolvedIssues: SideArmsRaiseGuidanceIssue[];
    recentGuidanceEvents: SideArmsRaiseGuidanceEvent[];
}

const REQUIRED_CONSECUTIVE_FRAMES = 2;
const REQUIRED_ISSUE_CONSECUTIVE_FRAMES = 2;
const MAX_RECENT_GUIDANCE_EVENTS = 3;
const SIDE_HEIGHT_DIFF_THRESHOLD = 0.25;
const SHOULDER_HEIGHT_LOW_THRESHOLD = 0.35;
const SHOULDER_HEIGHT_HIGH_THRESHOLD = -0.35;
const MIN_SIDE_REACH = 0.3;
const SIDE_ARMS_RAISE_EXERCISE_NAME = "Side Arms Raise";

export const INITIAL_SIDE_ARMS_RAISE_STATE: SideArmsRaiseGuidanceState = {
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

export function supportsSideArmsRaiseGuidance(exerciseName: string): boolean {
    return exerciseName.trim().toLowerCase().replaceAll(/[-_]+/g, " ") === "side arms raise";
}

export function updateSideArmsRaiseGuidance(
    previous: SideArmsRaiseGuidanceState,
    landmarks: PoseLandmarkMap | null,
): SideArmsRaiseGuidanceSnapshot {
    const upperBodyLandmarks = toUpperBodyLandmarks(landmarks);

    if (!upperBodyLandmarks || !hasReliableUpperBodyLandmarks(upperBodyLandmarks)) {
        return {
            state: {
                ...previous,
                consecutiveDownFrames: 0,
                consecutiveTopFrames: 0,
            },
            message: "Move fully into the frame so both shoulders and elbows are visible.",
            hasReliablePose: false,
            justCompletedRepetition: false,
            keyPoints: getRequiredExerciseKeyPointVisibility(
                SIDE_ARMS_RAISE_EXERCISE_NAME,
                landmarks,
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
                SIDE_ARMS_RAISE_EXERCISE_NAME,
                landmarks,
            ),
            activeIssues: [],
            resolvedIssues: [],
            recentGuidanceEvents: previous.recentGuidanceEvents,
        };
    }

    const leftDrop = (upperBodyLandmarks.leftElbow.y - upperBodyLandmarks.leftShoulder.y) / shoulderWidth;
    const rightDrop = (upperBodyLandmarks.rightElbow.y - upperBodyLandmarks.rightShoulder.y) / shoulderWidth;
    const leftReach = Math.abs(upperBodyLandmarks.leftElbow.x - upperBodyLandmarks.leftShoulder.x) / shoulderWidth;
    const rightReach = Math.abs(upperBodyLandmarks.rightElbow.x - upperBodyLandmarks.rightShoulder.x) / shoulderWidth;

    const armsDown = leftDrop > 0.45 && rightDrop > 0.45;
    const armsAtShoulderHeight =
        Math.abs(leftDrop) < 0.3 &&
        Math.abs(rightDrop) < 0.3 &&
        leftReach > 0.35 &&
        rightReach > 0.35;

    const consecutiveDownFrames = armsDown
        ? Math.min(previous.consecutiveDownFrames + 1, REQUIRED_CONSECUTIVE_FRAMES)
        : 0;
    const consecutiveTopFrames = armsAtShoulderHeight
        ? Math.min(previous.consecutiveTopFrames + 1, REQUIRED_CONSECUTIVE_FRAMES)
        : 0;
    const confirmedDown = consecutiveDownFrames === REQUIRED_CONSECUTIVE_FRAMES;
    const confirmedTop = consecutiveTopFrames === REQUIRED_CONSECUTIVE_FRAMES;

    let phase = previous.phase;
    let repetitions = previous.repetitions;
    let justCompletedRepetition = false;

    switch (previous.phase) {
        case "positioning":
            if (confirmedDown) phase = "ready";
            break;
        case "ready":
            if (confirmedTop) phase = "top";
            else if (!armsDown) phase = "raising";
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
            } else if (!armsAtShoulderHeight) {
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
        leftDrop,
        rightDrop,
        leftReach,
        rightReach,
    );
    const verifiedIssues = updateVerifiedIssues(previous, correctionIssue);
    const guidanceEvents = [
        ...verifiedIssues.events,
        ...(justCompletedRepetition
            ? [{ type: "repetition_completed" as const, repetitionCount: repetitions }]
            : []),
    ];
    const state: SideArmsRaiseGuidanceState = {
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
            ? guidanceMessage(state, justCompletedRepetition)
            : correctionIssue?.instruction ?? guidanceMessage(state, justCompletedRepetition),
        hasReliablePose: true,
        justCompletedRepetition,
        keyPoints: getRequiredExerciseKeyPointVisibility(
            SIDE_ARMS_RAISE_EXERCISE_NAME,
            landmarks,
        ),
        activeIssues: state.activeIssue ? [state.activeIssue] : [],
        resolvedIssues: verifiedIssues.resolvedIssues,
        recentGuidanceEvents: state.recentGuidanceEvents,
    };
}

function hasReliableUpperBodyLandmarks(landmarks: UpperBodyLandmarks): boolean {
    return Object.values(landmarks).every((point) => point.visibility >= REQUIRED_VISIBILITY);
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
    state: SideArmsRaiseGuidanceState,
    justCompletedRepetition: boolean,
): string {
    if (justCompletedRepetition) {
        return `Repetition ${state.repetitions} complete. Raise both arms when ready.`;
    }

    switch (state.phase) {
        case "positioning":
            return "Start with both arms comfortably down at your sides.";
        case "ready":
            return "Raise both arms out to your sides.";
        case "raising":
            return "Continue toward shoulder height.";
        case "top":
            return "Shoulder height reached. Lower both arms slowly.";
        case "lowering":
            return "Continue lowering both arms in a controlled motion.";
    }
}

function correctiveGuidanceIssue(
    state: Pick<SideArmsRaiseGuidanceState, "phase">,
    leftDrop: number,
    rightDrop: number,
    leftReach: number,
    rightReach: number,
): SideArmsRaiseGuidanceIssue | null {
    if (state.phase !== "raising" && state.phase !== "top") {
        return null;
    }

    if (leftReach < MIN_SIDE_REACH && rightReach < MIN_SIDE_REACH) {
        return issue("both-arms-reach", "Reach both arms farther out to your sides.");
    }

    if (leftReach < MIN_SIDE_REACH) {
        return issue("left-arm-reach", "Reach your left arm farther out to the side.");
    }

    if (rightReach < MIN_SIDE_REACH) {
        return issue("right-arm-reach", "Reach your right arm farther out to the side.");
    }

    if (leftDrop - rightDrop > SIDE_HEIGHT_DIFF_THRESHOLD) {
        return issue("left-arm-height", "Raise your left arm higher to match your right arm.");
    }

    if (rightDrop - leftDrop > SIDE_HEIGHT_DIFF_THRESHOLD) {
        return issue("right-arm-height", "Raise your right arm higher to match your left arm.");
    }

    if (state.phase === "top") {
        if (leftDrop > SHOULDER_HEIGHT_LOW_THRESHOLD && rightDrop > SHOULDER_HEIGHT_LOW_THRESHOLD) {
            return issue("both-arms-low", "Raise both arms a little higher to shoulder height.");
        }

        if (leftDrop > SHOULDER_HEIGHT_LOW_THRESHOLD) {
            return issue("left-arm-low", "Raise your left arm a little higher to shoulder height.");
        }

        if (rightDrop > SHOULDER_HEIGHT_LOW_THRESHOLD) {
            return issue("right-arm-low", "Raise your right arm a little higher to shoulder height.");
        }

        if (leftDrop < SHOULDER_HEIGHT_HIGH_THRESHOLD && rightDrop < SHOULDER_HEIGHT_HIGH_THRESHOLD) {
            return issue("both-arms-high", "Lower both arms slightly back to shoulder height.");
        }

        if (leftDrop < SHOULDER_HEIGHT_HIGH_THRESHOLD) {
            return issue("left-arm-high", "Lower your left arm slightly back to shoulder height.");
        }

        if (rightDrop < SHOULDER_HEIGHT_HIGH_THRESHOLD) {
            return issue("right-arm-high", "Lower your right arm slightly back to shoulder height.");
        }
    }

    return null;
}

function issue(
    id: SideArmsRaiseGuidanceIssueId,
    instruction: string,
): SideArmsRaiseGuidanceIssue {
    return { id, instruction };
}

function updateVerifiedIssues(
    previous: SideArmsRaiseGuidanceState,
    candidateIssue: SideArmsRaiseGuidanceIssue | null,
): {
    state: Pick<
        SideArmsRaiseGuidanceState,
        "activeIssue" | "candidateIssue" | "candidateIssueFrames" | "absentIssueFrames"
    >;
    resolvedIssues: SideArmsRaiseGuidanceIssue[];
    events: SideArmsRaiseGuidanceEvent[];
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
    const events: SideArmsRaiseGuidanceEvent[] = [
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
    previousEvents: SideArmsRaiseGuidanceEvent[],
    newEvents: SideArmsRaiseGuidanceEvent[],
): SideArmsRaiseGuidanceEvent[] {
    return [...previousEvents, ...newEvents].slice(-MAX_RECENT_GUIDANCE_EVENTS);
}
