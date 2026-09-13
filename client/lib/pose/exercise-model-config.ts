export interface ExerciseModelGuidanceConfig {
  guidanceName: "Side Arms Raise" | "Shoulder Flexion" | "Shoulder Abduction";
  selectableSide: boolean;
  fixedSide?: "left" | "right";
}

const MODEL_GUIDANCE: Record<string, ExerciseModelGuidanceConfig> = {
  side_arms_raise_v1: { guidanceName: "Side Arms Raise", selectableSide: false },
  shoulder_flexion: { guidanceName: "Shoulder Flexion", selectableSide: true },
  shoulder_abduction: { guidanceName: "Shoulder Abduction", selectableSide: true },
  left_flexion: { guidanceName: "Shoulder Flexion", selectableSide: false, fixedSide: "left" },
  right_flexion: { guidanceName: "Shoulder Flexion", selectableSide: false, fixedSide: "right" },
  left_abduction: { guidanceName: "Shoulder Abduction", selectableSide: false, fixedSide: "left" },
  right_abduction: { guidanceName: "Shoulder Abduction", selectableSide: false, fixedSide: "right" },
};

export function getExerciseModelGuidanceConfig(modelKey?: string | null): ExerciseModelGuidanceConfig | null {
  return modelKey ? MODEL_GUIDANCE[modelKey] ?? null : null;
}
