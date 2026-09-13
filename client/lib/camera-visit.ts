import type { ExerciseModelGuidanceConfig } from "./pose/exercise-model-config";

export type ArmSide = "left" | "right";

export function resolveRecordingSide(
  config: ExerciseModelGuidanceConfig | null,
  selectedSide: ArmSide | null,
): ArmSide | null | undefined {
  return config?.fixedSide ?? (config?.selectableSide ? selectedSide : undefined);
}

export function canRecordArm(
  config: ExerciseModelGuidanceConfig | null,
  selectedSide: ArmSide | null,
  recordedSides: (ArmSide | undefined)[],
): boolean {
  if (!config) return false;
  const side = resolveRecordingSide(config, selectedSide);
  if (config.selectableSide && !side) return false;
  return !recordedSides.includes(side ?? undefined);
}

export function canSwitchArm(
  config: ExerciseModelGuidanceConfig | null,
  currentSide: ArmSide | null | undefined,
  recordedSides: (ArmSide | undefined)[],
): boolean {
  return Boolean(config?.selectableSide && currentSide && !recordedSides.includes(currentSide === "left" ? "right" : "left"));
}

export function getRecordingTimeState(elapsedSeconds: number, targetDurationSeconds?: number | null, minimumDurationSeconds?: number | null) {
  const target = targetDurationSeconds && targetDurationSeconds > 0 ? targetDurationSeconds : null;
  return {
    progress: target ? Math.min(100, (elapsedSeconds / target) * 100) : 0,
    goalReached: target !== null && elapsedSeconds >= target,
    belowMinimum: Boolean(minimumDurationSeconds && elapsedSeconds < minimumDurationSeconds),
  };
}
