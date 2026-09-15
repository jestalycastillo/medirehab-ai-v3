export interface ExerciseModelGuidanceConfig {
  guidanceName: "Shoulder Flexion" | "Shoulder Abduction";
  selectableSide: boolean;
  fixedSide?: "left" | "right";
}

const MODEL_GUIDANCE: Record<string, ExerciseModelGuidanceConfig> = {
  shoulder_flexion: { guidanceName: "Shoulder Flexion", selectableSide: true },
  shoulder_abduction: { guidanceName: "Shoulder Abduction", selectableSide: true },
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

export function getExerciseDemoVideoUrl(
  exerciseName?: string,
  selectedSide?: "left" | "right" | null,
  modelKey?: string | null
): string {
  const norm = (exerciseName || "").toLowerCase();
  const key = (modelKey || "").toLowerCase();

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
