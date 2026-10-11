import { HttpError } from "./httpError";

// Demo grouping mapped to the existing catalog; this does not set clinical targets.
// References: https://msk-bexley.nhs.uk/conditions/shoulder-pain/frozen-shoulder
// https://www.cuh.nhs.uk/patient-information/frozen-shoulder/
// https://www.mskdorset.nhs.uk/shoulder-pain/shoulder-pain-rotator-cuff-related-shoulder-pain/
// https://elht.nhs.uk/application/files/5117/3763/9581/OA_Shoulder.pdf
// These are demo approximations using catalog movements, not full treatment protocols.
export const EXERCISE_PRESETS = [
    {
        id: "frozen-shoulder",
        name: "Frozen shoulder",
        description: "Demo preset for shoulder mobility. Review each exercise and tailor the care plan to the patient.",
        exerciseNames: ["Shoulder Flexion", "Shoulder Abduction", "External Rotation", "Cross-body Shoulder Stretch"]
    },
    {
        id: "shoulder-impingement",
        name: "Shoulder impingement",
        description: "Demo group for rotator cuff related shoulder pain, combining forward movement, outward rotation, and a cross-body stretch. Tailor the plan after reviewing the patient.",
        exerciseNames: ["Shoulder Flexion", "External Rotation", "Cross-body Shoulder Stretch"]
    },
    {
        id: "shoulder-osteoarthritis",
        name: "Shoulder osteoarthritis",
        description: "Demo group for shoulder stiffness, covering forward, sideways, and rotational movement. Review comfortable range and individual targets.",
        exerciseNames: ["Shoulder Flexion", "Shoulder Abduction", "External Rotation", "Internal Rotation"]
    },
    {
        id: "general-shoulder-mobility",
        name: "General shoulder mobility",
        description: "Demo group combining circular, forward, and sideways arm movements. Adjust range and goals for the patient.",
        exerciseNames: ["Arm Circumduction", "Shoulder Flexion", "Shoulder Abduction"]
    },
    {
        id: "shoulder-rotation-flexibility",
        name: "Shoulder rotation and flexibility",
        description: "Demo group focused on inward and outward rotation with a cross-body shoulder stretch. Review exercise suitability and hold durations.",
        exerciseNames: ["External Rotation", "Internal Rotation", "Cross-body Shoulder Stretch"]
    },
    {
        id: "shoulder-elevation",
        name: "Shoulder elevation",
        description: "Demo group for forward and sideways arm elevation, including a movement that raises both arms together. Set targets for each exercise individually.",
        exerciseNames: ["Shoulder Flexion", "Shoulder Abduction", "Side Arms Raise"]
    }
] as const;

export function getExercisePreset(id: unknown) {
    const preset = EXERCISE_PRESETS.find((item) => item.id === id);
    if (!preset) throw new HttpError(400, "Choose a valid exercise preset.");
    return preset;
}

export function resolvePresetExercises<T extends { id: string; name: string }>(
    preset: { exerciseNames: readonly string[] }, exercises: T[]
) {
    const resolved = preset.exerciseNames.map((name) => exercises.find((exercise) => exercise.name === name));
    return {
        exercises: resolved.filter((exercise): exercise is T => exercise !== undefined),
        missingExerciseNames: preset.exerciseNames.filter((_, index) => resolved[index] === undefined)
    };
}
