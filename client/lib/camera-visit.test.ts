import assert from "node:assert/strict";
import test from "node:test";
import { canRecordArm, canSwitchArm, getRecordingTimeState, resolveRecordingSide } from "./camera-visit";
import { getExerciseModelGuidanceConfig } from "./pose/exercise-model-config";
import { formatAssignmentScoreSummary } from "./score";
import type { ExerciseAssignment } from "./api";

test("generic shoulder exercises start on the left and can switch only to an unrecorded arm", () => {
  const config = getExerciseModelGuidanceConfig("shoulder_flexion");
  assert(config);
  assert.equal(resolveRecordingSide(config, null), "left");
  assert.equal(canRecordArm(config, null, []), true);
  assert.equal(canRecordArm(config, "left", []), true);
  assert.equal(canSwitchArm(config, "left", []), true);
  assert.equal(canRecordArm(config, "left", ["left"]), false);
  assert.equal(canRecordArm(config, "right", ["left"]), true);
  assert.equal(canSwitchArm(config, "right", ["left"]), false);
});

test("fixed-side exercises cannot switch and bilateral exercises do not select an arm", () => {
  const fixed = getExerciseModelGuidanceConfig("left_flexion");
  assert.equal(resolveRecordingSide(fixed, "right"), "left");
  assert.equal(canSwitchArm(fixed, "left", []), false);
  const bilateral = getExerciseModelGuidanceConfig("side_arms_raise_v1");
  assert.equal(resolveRecordingSide(bilateral, null), undefined);
  assert.equal(canRecordArm(bilateral, null, []), true);
  assert.equal(canRecordArm(bilateral, null, [undefined]), false);
});

test("prescribed time is a goal per arm, never an automatic stop", () => {
  assert.deepEqual(getRecordingTimeState(8, 20, 10), { progress: 40, goalReached: false, belowMinimum: true });
  assert.deepEqual(getRecordingTimeState(25, 20, 10), { progress: 100, goalReached: true, belowMinimum: false });
  assert.deepEqual(getRecordingTimeState(25, null, null), { progress: 0, goalReached: false, belowMinimum: false });
  assert.deepEqual(getRecordingTimeState(0, 20, 10), { progress: 0, goalReached: false, belowMinimum: true });
});

test("doctor score summary names each arm instead of displaying a combined score", () => {
  const assignment = {
    exercise: { analysisModelKey: "shoulder_abduction" },
    result: { id: "latest", score: 83 },
    latestScoresBySide: { left: 91.235, right: 83.1 },
  } as ExerciseAssignment;
  assert.equal(formatAssignmentScoreSummary(assignment), "Left 91.23 · Right 83.10");
});
