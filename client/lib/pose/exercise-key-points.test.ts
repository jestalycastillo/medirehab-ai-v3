import assert from "node:assert/strict";
import test from "node:test";
import { getRequiredExerciseKeyPointVisibility } from "./exercise-key-points";
import type { PoseLandmarkMap } from "./pose-landmarker.types";
import { getExerciseDemoVideoUrl, getNewExerciseInstructions } from "./exercise-model-config";

test("new shoulder exercises require wrists and never require legs", () => {
    for (const exercise of ["Arm_Circumduction", "cross-body_shoulder_stretch", "external-rotation", "internal-rotation"]) {
        for (const side of ["left", "right"] as const) {
            for (const name of [exercise, `${side} ${exercise}`]) {
                const points = getRequiredExerciseKeyPointVisibility(name, null, undefined, side);
                assert.deepEqual(points.map((point) => point.id), [
                    "nose", "chest", "leftShoulder", "rightShoulder", "leftElbow", "rightElbow", "leftWrist", "rightWrist",
                ]);
            }
        }
    }
});

test("a hidden wrist prevents the new profile from being fully visible", () => {
    const landmarks: PoseLandmarkMap = {};
    for (const { id } of getRequiredExerciseKeyPointVisibility("external rotation", null)) {
        landmarks[id] = { x: 0.5, y: 0.5, visibility: 1 };
    }
    landmarks.leftWrist!.visibility = 0.2;
    const points = getRequiredExerciseKeyPointVisibility("external rotation", landmarks);
    assert.deepEqual(points.filter((point) => !point.isVisible).map((point) => point.id), ["leftWrist"]);
});

test("existing side-specific flexion requirements are preserved", () => {
    assert.deepEqual(getRequiredExerciseKeyPointVisibility("Shoulder Flexion", null, undefined, "left").map((point) => point.id),
        ["nose", "chest", "leftShoulder", "rightShoulder", "leftElbow"]);
});

test("new exercises use their own instructions rather than a flexion demonstration", () => {
    for (const key of ["arm_circumduction", "cross_body_shoulder_stretch", "external_rotation", "internal_rotation"]) {
        assert(getNewExerciseInstructions(key));
        assert.equal(getExerciseDemoVideoUrl(undefined, "right", key), "");
    }
    assert.equal(getNewExerciseInstructions("shoulder_flexion"), null);
    assert.equal(getExerciseDemoVideoUrl("Shoulder Flexion", "right"), "/exercises/videos/right_shoulder_flexion.mp4");
});
