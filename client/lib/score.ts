import type { ExerciseAssignment } from "./api";

export function formatScore(score?: number | null): string {
  return Number.isFinite(score) ? Number(score).toFixed(2) : "0.00";
}

export function formatAssignmentScoreSummary(assignment: ExerciseAssignment): string {
  if (assignment.exercise.analysisModelKey === "shoulder_flexion" || assignment.exercise.analysisModelKey === "shoulder_abduction") {
    const sides = (["left", "right"] as const)
      .filter((side) => assignment.latestScoresBySide?.[side] !== undefined)
      .map((side) => `${side === "left" ? "Left" : "Right"} ${formatScore(assignment.latestScoresBySide?.[side])}`);
    return sides.length ? sides.join(" · ") : "No score yet";
  }
  return assignment.result ? `Score ${formatScore(assignment.result.score)}` : "No score yet";
}
