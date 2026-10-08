import assert from "node:assert/strict";
import test from "node:test";
import {
    evaluateNewShoulderExerciseGuidance,
    supportsNewShoulderExerciseGuidance,
} from "./new-shoulder-exercise-guidance";
import type { PoseLandmarkMap } from "./pose-landmarker.types";

const visibleUpperBody: PoseLandmarkMap = {
    nose: { x: 0.5, y: 0.2, visibility: 1 },
    chest: { x: 0.5, y: 0.42, visibility: 1 },
    leftShoulder: { x: 0.4, y: 0.4, visibility: 1 },
    rightShoulder: { x: 0.6, y: 0.4, visibility: 1 },
    leftElbow: { x: 0.1, y: 0.4, visibility: 1 },
    rightElbow: { x: 0.9, y: 0.4, visibility: 1 },
    leftWrist: { x: 0.0, y: 0.4, visibility: 1 },
    rightWrist: { x: 1.0, y: 0.4, visibility: 1 },
};

test("new shoulder exercises have dedicated live coaching rules", () => {
    for (const exercise of ["Arm Circumduction", "Cross-body Shoulder Stretch", "External Rotation", "Internal Rotation"]) {
        assert.equal(supportsNewShoulderExerciseGuidance(exercise), true);
    }
    assert.equal(supportsNewShoulderExerciseGuidance("Shoulder Flexion"), false);
});

test("new rules require every model body point before giving form prompts", () => {
    const snapshot = evaluateNewShoulderExerciseGuidance(
        "External Rotation",
        { ...visibleUpperBody, rightWrist: { x: 1, y: 0.4, visibility: 0.2 } },
        "left",
    );
    assert.equal(snapshot.hasReliablePose, false);
    assert.equal(snapshot.activeIssues.length, 0);
    assert.equal(snapshot.keyPoints.find((point) => point.id === "rightWrist")?.isVisible, false);
});

test("circumduction prompts when the selected elbow is bent", () => {
    const snapshot = evaluateNewShoulderExerciseGuidance(
        "Arm Circumduction",
        { ...visibleUpperBody, leftWrist: { x: 0.4, y: 0.6, visibility: 1 } },
        "left",
    );
    assert.equal(snapshot.activeIssues[0]?.id, "target-elbow-bent");
});

test("rotation rules do not choose a patient arm and accept either bent elbow", () => {
    const snapshot = evaluateNewShoulderExerciseGuidance(
        "Internal Rotation",
        { ...visibleUpperBody, leftWrist: { x: 0.1, y: 0.6, visibility: 1 } },
        "right",
    );
    assert.equal(snapshot.hasReliablePose, true);
    assert.equal(snapshot.activeIssues.length, 0);
});
