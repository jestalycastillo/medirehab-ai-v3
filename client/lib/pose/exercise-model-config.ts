export interface ExerciseModelGuidanceConfig {
  guidanceName: "Shoulder Flexion" | "Shoulder Abduction" | "Arm Circumduction" | "Cross-body Shoulder Stretch" | "External Rotation" | "Internal Rotation";
  selectableSide: boolean;
  fixedSide?: "left" | "right";
}

const MODEL_GUIDANCE: Record<string, ExerciseModelGuidanceConfig> = {
  shoulder_flexion: { guidanceName: "Shoulder Flexion", selectableSide: true },
  shoulder_abduction: { guidanceName: "Shoulder Abduction", selectableSide: true },
  arm_circumduction: { guidanceName: "Arm Circumduction", selectableSide: true },
  cross_body_shoulder_stretch: { guidanceName: "Cross-body Shoulder Stretch", selectableSide: true },
  external_rotation: { guidanceName: "External Rotation", selectableSide: false },
  internal_rotation: { guidanceName: "Internal Rotation", selectableSide: false },
  left_flexion: { guidanceName: "Shoulder Flexion", selectableSide: false, fixedSide: "left" },
  left_flexion_v2: { guidanceName: "Shoulder Flexion", selectableSide: false, fixedSide: "left" },
  right_flexion: { guidanceName: "Shoulder Flexion", selectableSide: false, fixedSide: "right" },
  right_flexion_v2: { guidanceName: "Shoulder Flexion", selectableSide: false, fixedSide: "right" },
  left_abduction: { guidanceName: "Shoulder Abduction", selectableSide: false, fixedSide: "left" },
  left_abduction_v2: { guidanceName: "Shoulder Abduction", selectableSide: false, fixedSide: "left" },
  right_abduction: { guidanceName: "Shoulder Abduction", selectableSide: false, fixedSide: "right" },
  right_abduction_v2: { guidanceName: "Shoulder Abduction", selectableSide: false, fixedSide: "right" },
};

export function getExerciseModelGuidanceConfig(modelKey?: string | null): ExerciseModelGuidanceConfig | null {
  return modelKey ? MODEL_GUIDANCE[modelKey] ?? null : null;
}

const NEW_EXERCISE_INSTRUCTIONS: Record<string, string> = {
  arm_circumduction: "Use the selected arm for the circular movement prescribed by your clinician. Keep both shoulders, elbows, and wrists visible throughout the recording.",
  cross_body_shoulder_stretch: "Use the selected arm for the cross-body stretch and follow your prescribed hold duration. Keep the stretching arm and the supporting arm visible.",
  external_rotation: "Follow your clinician’s prescribed outward forearm rotation and arm position. Keep both shoulders, elbows, and wrists visible.",
  internal_rotation: "Follow your clinician’s prescribed inward forearm rotation and arm position. Keep both shoulders, elbows, and wrists visible.",
};

export function getNewExerciseInstructions(modelKey?: string | null, exerciseName?: string): string | null {
  const key = modelKey || (exerciseName ?? "").trim().toLowerCase().replaceAll(/[-\s]+/g, "_");
  return NEW_EXERCISE_INSTRUCTIONS[key] ?? null;
}

export function getExerciseIllustrationUrl(modelKey?: string | null, exerciseName?: string): string | null {
  const key = modelKey || (exerciseName ?? "").trim().toLowerCase().replaceAll(/[-\s]+/g, "_");
  return NEW_EXERCISE_INSTRUCTIONS[key] ? `/exercises/${key}.png` : null;
}

export function getExerciseDemoVideoUrl(
  exerciseName?: string,
  selectedSide?: "left" | "right" | null,
  modelKey?: string | null
): string {
  const norm = (exerciseName || "").toLowerCase();
  const key = (modelKey || "").toLowerCase();

  if (getNewExerciseInstructions(modelKey, exerciseName)) {
    return "";
  }

  if (norm.includes("flexion") || key.includes("flexion")) {
    if (selectedSide === "right" || key.includes("right")) {
      return "/exercises/videos/right_shoulder_flexion.mp4";
    }
    return "/exercises/videos/left_shoulder_flexion.mp4";
  }

  if (norm.includes("abduction") || key.includes("abduction")) {
    if (selectedSide === "right" || key.includes("right")) {
      return "/exercises/videos/right_shoulder_abduction.mp4";
    }
    return "/exercises/videos/left_shoulder_abduction.mp4";
  }

  if (selectedSide === "right" || key.includes("right")) {
    return "/exercises/videos/right_shoulder_flexion.mp4";
  }
  return "/exercises/videos/left_shoulder_flexion.mp4";
}
