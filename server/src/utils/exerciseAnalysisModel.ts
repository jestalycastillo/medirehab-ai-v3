import { HttpError } from "./httpError";

type ExerciseSide = "left" | "right";

export const isSideSelectableExercise = (modelKey?: string | null): boolean =>
    ["shoulder_flexion", "shoulder_abduction", "arm_circumduction", "cross_body_shoulder_stretch"].includes(modelKey ?? "");

export function resolveExerciseAnalysisModel(
    modelKey: string,
    selectedSide?: ExerciseSide,
): { evaluatedModelKey: string; selectedSide: ExerciseSide | null } {
    if (modelKey === "arm_circumduction" || modelKey === "cross_body_shoulder_stretch") {
        if (!selectedSide) throw new HttpError(400, "Select the left or right arm before evaluation.");
        return { evaluatedModelKey: modelKey, selectedSide };
    }
    if (modelKey === "shoulder_flexion" || modelKey === "shoulder_abduction") {
        if (!selectedSide) {
            throw new HttpError(400, "Select the left or right arm before evaluation.");
        }
        const movement = modelKey === "shoulder_flexion" ? "flexion" : "abduction";
        return { evaluatedModelKey: `${selectedSide}_${movement}`, selectedSide };
    }

    const fixedSide = modelKey.startsWith("left_")
        ? "left"
        : modelKey.startsWith("right_")
            ? "right"
            : null;
    if (fixedSide && selectedSide && selectedSide !== fixedSide) {
        throw new HttpError(400, "The selected arm does not match this exercise.");
    }
    if (!fixedSide && selectedSide) {
        throw new HttpError(400, "This exercise does not use an arm selection.");
    }
    return { evaluatedModelKey: modelKey, selectedSide: fixedSide };
}
