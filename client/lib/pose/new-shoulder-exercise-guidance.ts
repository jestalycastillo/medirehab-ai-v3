import {
    getRequiredExerciseKeyPointVisibility,
    normalizeExerciseName,
    type ExerciseKeyPointVisibility,
} from "./exercise-key-points";
import type { PoseLandmarkMap, PosePoint } from "./pose-landmarker.types";

export type NewShoulderGuidanceIssueId =
    | "shoulders-not-level"
    | "target-elbow-bent"
    | "target-arm-low"
    | "rotation-elbow-straight";

export interface NewShoulderGuidanceIssue {
    id: NewShoulderGuidanceIssueId;
    instruction: string;
}

export interface NewShoulderGuidanceSnapshot {
    message: string;
    hasReliablePose: boolean;
    keyPoints: ExerciseKeyPointVisibility[];
    activeIssues: NewShoulderGuidanceIssue[];
}

const NEW_SHOULDER_EXERCISES = new Set([
    "arm circumduction",
    "cross body shoulder stretch",
    "external rotation",
    "internal rotation",
]);

export function supportsNewShoulderExerciseGuidance(exerciseName: string): boolean {
    return NEW_SHOULDER_EXERCISES.has(normalizeExerciseName(exerciseName));
}

export function getNewShoulderGuidanceInitialMessage(
    exerciseName: string,
    selectedSide: "left" | "right",
): string {
    const normalized = normalizeExerciseName(exerciseName);
    if (normalized === "arm circumduction") {
        return `Move fully into frame so both arms are visible, then prepare your ${selectedSide} arm for the circular motion.`;
    }
    if (normalized === "cross body shoulder stretch") {
        return `Move fully into frame so both arms are visible, then prepare your ${selectedSide} arm for the cross-body stretch.`;
    }
    return "Move fully into frame so both shoulders, elbows, and wrists are visible.";
}

export function evaluateNewShoulderExerciseGuidance(
    exerciseName: string,
    landmarks: PoseLandmarkMap | null,
    selectedSide: "left" | "right",
): NewShoulderGuidanceSnapshot {
    const normalized = normalizeExerciseName(exerciseName);
    const keyPoints = getRequiredExerciseKeyPointVisibility(exerciseName, landmarks, undefined, selectedSide);
    if (!keyPoints.every((point) => point.isVisible)) {
        return {
            message: getNewShoulderGuidanceInitialMessage(exerciseName, selectedSide),
            hasReliablePose: false,
            keyPoints,
            activeIssues: [],
        };
    }

    const leftShoulder = landmarks?.leftShoulder;
    const rightShoulder = landmarks?.rightShoulder;
    if (!leftShoulder || !rightShoulder) {
        return {
            message: getNewShoulderGuidanceInitialMessage(exerciseName, selectedSide),
            hasReliablePose: false,
            keyPoints,
            activeIssues: [],
        };
    }

    const shoulderWidth = distance(leftShoulder, rightShoulder);
    if (shoulderWidth < 0.08) {
        return {
            message: "Face the camera and keep both shoulders visible.",
            hasReliablePose: false,
            keyPoints,
            activeIssues: [],
        };
    }

    const shoulderTilt = Math.abs(leftShoulder.y - rightShoulder.y) / shoulderWidth;
    if (shoulderTilt > 0.35) {
        return issueSnapshot(
            "shoulders-not-level",
            "Face the camera with your shoulders level so the movement can be tracked.",
            keyPoints,
        );
    }

    const target = selectedSide === "left"
        ? { shoulder: landmarks?.leftShoulder, elbow: landmarks?.leftElbow, wrist: landmarks?.leftWrist }
        : { shoulder: landmarks?.rightShoulder, elbow: landmarks?.rightElbow, wrist: landmarks?.rightWrist };
    const sideLabel = selectedSide === "left" ? "left" : "right";

    if (normalized === "arm circumduction" && isArm(target)) {
        if (jointAngle(target.shoulder, target.elbow, target.wrist) < 145) {
            return issueSnapshot(
                "target-elbow-bent",
                `Keep your ${sideLabel} elbow straight enough for the circular arm motion to be clear.`,
                keyPoints,
            );
        }
        return readySnapshot(
            `Keep your ${sideLabel} arm visible and complete the prescribed circular motion.`,
            keyPoints,
        );
    }

    if (normalized === "cross body shoulder stretch" && isArm(target)) {
        const elbowDrop = Math.abs(target.elbow.y - target.shoulder.y) / shoulderWidth;
        if (elbowDrop > 0.45) {
            return issueSnapshot(
                "target-arm-low",
                `Bring your ${sideLabel} arm up across your chest so the stretch position is visible.`,
                keyPoints,
            );
        }
        return readySnapshot(
            `Keep your ${sideLabel} arm across your chest and keep the supporting arm visible.`,
            keyPoints,
        );
    }

    const leftArm = { shoulder: landmarks?.leftShoulder, elbow: landmarks?.leftElbow, wrist: landmarks?.leftWrist };
    const rightArm = { shoulder: landmarks?.rightShoulder, elbow: landmarks?.rightElbow, wrist: landmarks?.rightWrist };
    const hasBentArm = [leftArm, rightArm].some((arm) => {
        if (!isArm(arm)) return false;
        const angle = jointAngle(arm.shoulder, arm.elbow, arm.wrist);
        return angle >= 55 && angle <= 135;
    });
    if (!hasBentArm) {
        return issueSnapshot(
            "rotation-elbow-straight",
            "Keep the active elbow bent so the forearm rotation is visible.",
            keyPoints,
        );
    }
    return readySnapshot(
        "Keep both shoulders, elbows, and wrists visible while you complete the prescribed rotation.",
        keyPoints,
    );
}

function issueSnapshot(
    id: NewShoulderGuidanceIssueId,
    instruction: string,
    keyPoints: ExerciseKeyPointVisibility[],
): NewShoulderGuidanceSnapshot {
    return { message: instruction, hasReliablePose: true, keyPoints, activeIssues: [{ id, instruction }] };
}

function readySnapshot(message: string, keyPoints: ExerciseKeyPointVisibility[]): NewShoulderGuidanceSnapshot {
    return { message, hasReliablePose: true, keyPoints, activeIssues: [] };
}

function isArm(arm: { shoulder?: PosePoint; elbow?: PosePoint; wrist?: PosePoint }): arm is {
    shoulder: PosePoint;
    elbow: PosePoint;
    wrist: PosePoint;
} {
    return Boolean(arm.shoulder && arm.elbow && arm.wrist);
}

function distance(a: PosePoint, b: PosePoint): number {
    return Math.hypot(a.x - b.x, a.y - b.y);
}

function jointAngle(a: PosePoint, b: PosePoint, c: PosePoint): number {
    const ba = { x: a.x - b.x, y: a.y - b.y };
    const bc = { x: c.x - b.x, y: c.y - b.y };
    const magnitude = Math.hypot(ba.x, ba.y) * Math.hypot(bc.x, bc.y);
    if (magnitude === 0) return 0;
    const cosine = Math.max(-1, Math.min(1, (ba.x * bc.x + ba.y * bc.y) / magnitude));
    return Math.acos(cosine) * (180 / Math.PI);
}
