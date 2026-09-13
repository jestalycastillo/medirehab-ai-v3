import type { PoseLandmarkKey, PoseLandmarkMap } from "./pose-landmarker.types";

export interface ExerciseKeyPointVisibility {
    id: PoseLandmarkKey;
    label: string;
    side: "left" | "right" | "center";
    region:
        | "head"
        | "shoulder"
        | "elbow"
        | "wrist"
        | "hip"
        | "knee"
        | "ankle";
    isRequired: boolean;
    isVisible: boolean;
}

export const REQUIRED_VISIBILITY = 0.6;

const KEY_POINT_DETAILS: Record<
    PoseLandmarkKey,
    Omit<ExerciseKeyPointVisibility, "isRequired" | "isVisible">
> = {
    nose: { id: "nose", label: "Head", side: "center", region: "head" },
    leftShoulder: { id: "leftShoulder", label: "Left shoulder", side: "left", region: "shoulder" },
    rightShoulder: { id: "rightShoulder", label: "Right shoulder", side: "right", region: "shoulder" },
    leftElbow: { id: "leftElbow", label: "Left elbow", side: "left", region: "elbow" },
    rightElbow: { id: "rightElbow", label: "Right elbow", side: "right", region: "elbow" },
    leftWrist: { id: "leftWrist", label: "Left wrist", side: "left", region: "wrist" },
    rightWrist: { id: "rightWrist", label: "Right wrist", side: "right", region: "wrist" },
    leftHip: { id: "leftHip", label: "Left hip", side: "left", region: "hip" },
    rightHip: { id: "rightHip", label: "Right hip", side: "right", region: "hip" },
    leftKnee: { id: "leftKnee", label: "Left knee", side: "left", region: "knee" },
    rightKnee: { id: "rightKnee", label: "Right knee", side: "right", region: "knee" },
    leftAnkle: { id: "leftAnkle", label: "Left ankle", side: "left", region: "ankle" },
    rightAnkle: { id: "rightAnkle", label: "Right ankle", side: "right", region: "ankle" },
};

const EXERCISE_REQUIRED_KEY_POINTS: Record<string, PoseLandmarkKey[]> = {
    "side arms raise": ["leftShoulder", "rightShoulder", "leftElbow", "rightElbow"],
    "left shoulder flexion": ["leftShoulder", "rightShoulder", "leftElbow", "rightElbow"],
    "right shoulder flexion": ["leftShoulder", "rightShoulder", "leftElbow", "rightElbow"],
    "shoulder flexion": ["leftShoulder", "rightShoulder", "leftElbow", "rightElbow"],
    "shoulder abduction": ["leftShoulder", "rightShoulder", "leftElbow", "rightElbow"],
};

export function getExerciseKeyPointVisibility(
    exerciseName: string,
    landmarks: PoseLandmarkMap | null,
    requiredVisibility = REQUIRED_VISIBILITY,
    selectedSide?: "left" | "right"
): ExerciseKeyPointVisibility[] {
    const normalized = normalizeExerciseName(exerciseName);
    let requiredList: PoseLandmarkKey[] | undefined;

    if (
        normalized.includes("flexion") ||
        normalized.includes("abduction") ||
        normalized === "shoulder flexion" ||
        normalized === "shoulder abduction"
    ) {
        if (selectedSide === "left" || normalized.includes("left")) {
            requiredList = ["leftShoulder", "rightShoulder", "leftElbow"];
        } else if (selectedSide === "right" || normalized.includes("right")) {
            requiredList = ["leftShoulder", "rightShoulder", "rightElbow"];
        } else {
            requiredList = ["leftShoulder", "rightShoulder", "leftElbow", "rightElbow"];
        }
    } else {
        requiredList = EXERCISE_REQUIRED_KEY_POINTS[normalized];
    }

    if (!requiredList) {
        if (normalized.includes("arm") || normalized.includes("shoulder")) {
            requiredList = ["leftShoulder", "rightShoulder", "leftElbow", "rightElbow"];
        } else if (normalized.includes("squat") || normalized.includes("knee") || normalized.includes("leg")) {
            requiredList = ["leftHip", "rightHip", "leftKnee", "rightKnee"];
        } else {
            requiredList = ["leftShoulder", "rightShoulder", "leftElbow", "rightElbow"];
        }
    }

    const requiredIds = new Set(requiredList);

    return Object.values(KEY_POINT_DETAILS).map((point) => ({
        ...point,
        isRequired: requiredIds.has(point.id),
        isVisible: (landmarks?.[point.id]?.visibility ?? 0) >= requiredVisibility,
    }));
}

export function getRequiredExerciseKeyPointVisibility(
    exerciseName: string,
    landmarks: PoseLandmarkMap | null,
    requiredVisibility = REQUIRED_VISIBILITY,
    selectedSide?: "left" | "right"
): ExerciseKeyPointVisibility[] {
    return getExerciseKeyPointVisibility(
        exerciseName,
        landmarks,
        requiredVisibility,
        selectedSide,
    ).filter((point) => point.isRequired);
}

export function exerciseSupportsKeyPointVisibility(exerciseName: string): boolean {
    const normalized = normalizeExerciseName(exerciseName);
    return normalized in EXERCISE_REQUIRED_KEY_POINTS || normalized.length > 0;
}

export function normalizeExerciseName(exerciseName: string): string {
    return exerciseName.trim().toLowerCase().replaceAll(/[-_]+/g, " ");
}
