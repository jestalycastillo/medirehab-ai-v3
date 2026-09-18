import assert from "node:assert/strict";
import test from "node:test";
import {
    INITIAL_SHOULDER_ABDUCTION_STATE,
    updateShoulderAbductionGuidance,
} from "./shoulder-abduction-guidance";
import {
    INITIAL_SHOULDER_FLEXION_STATE,
    updateShoulderFlexionGuidance,
} from "./shoulder-flexion-guidance";
import { classifyShoulderMovementDirection } from "./shoulder-movement-direction";
import type { PoseLandmarkMap, PoseWorldLandmarkMap } from "./pose-landmarker.types";

type Direction = "forward" | "sideways" | "down";
type Side = "left" | "right";

function pose(side: Side, direction: Direction): {
    image: PoseLandmarkMap;
    world: PoseWorldLandmarkMap;
} {
    const targetX = side === "left" ? 0.4 : 0.6;
    const otherX = side === "left" ? 0.6 : 0.4;
    const targetWorldX = side === "left" ? -0.2 : 0.2;
    const otherWorldX = -targetWorldX;
    const outwardSign = side === "left" ? -1 : 1;
    const image = {
        leftShoulder: { x: 0.4, y: 0.35, visibility: 1 },
        rightShoulder: { x: 0.6, y: 0.35, visibility: 1 },
        leftElbow: { x: side === "left" ? targetX : otherX, y: 0.62, visibility: 1 },
        rightElbow: { x: side === "right" ? targetX : otherX, y: 0.62, visibility: 1 },
    } satisfies PoseLandmarkMap;
    const world = {
        leftShoulder: { x: -0.2, y: 0.1, z: 0, visibility: 1 },
        rightShoulder: { x: 0.2, y: 0.1, z: 0, visibility: 1 },
        leftElbow: { x: side === "left" ? targetWorldX : otherWorldX, y: 0.38, z: 0, visibility: 1 },
        rightElbow: { x: side === "right" ? targetWorldX : otherWorldX, y: 0.38, z: 0, visibility: 1 },
    } satisfies PoseWorldLandmarkMap;
    if (direction !== "down") {
        const elbowKey = side === "left" ? "leftElbow" : "rightElbow";
        image[elbowKey] = {
            x: targetX + (direction === "sideways" ? outwardSign * 0.15 : 0),
            y: 0.35,
            visibility: 1,
        };
        world[elbowKey] = {
            x: targetWorldX + (direction === "sideways" ? outwardSign * 0.28 : 0),
            y: 0.1,
            z: direction === "forward" ? -0.28 : 0,
            visibility: 1,
        };
    }
    return { image, world };
}

for (const side of ["left", "right"] as const) {
    test(`${side}: classifies forward and lateral movement`, () => {
        assert.equal(classifyShoulderMovementDirection(pose(side, "forward").world, side), "forward");
        assert.equal(classifyShoulderMovementDirection(pose(side, "sideways").world, side), "sideways");
        assert.equal(classifyShoulderMovementDirection(pose(side, "down").world, side), "uncertain");
        assert.equal(classifyShoulderMovementDirection(null, side), "uncertain");
        const obscured = pose(side, "forward").world;
        const elbowKey = side === "left" ? "leftElbow" : "rightElbow";
        obscured[elbowKey]!.visibility = 0.2;
        assert.equal(classifyShoulderMovementDirection(obscured, side), "uncertain");
    });

    test(`${side}: flexion counts a forward raise, not a sideways raise`, () => {
        let state = INITIAL_SHOULDER_FLEXION_STATE;
        const frame = (direction: Direction, withWorld = true) => {
            const current = pose(side, direction);
            const snapshot = updateShoulderFlexionGuidance(
                state,
                current.image,
                side,
                withWorld ? current.world : null,
            );
            state = snapshot.state;
            return snapshot;
        };
        frame("down"); frame("down");
        frame("sideways");
        const wrong = frame("sideways");
        assert.equal(wrong.state.phase, "raising");
        assert.match(wrong.message, /forward, not out to the side/);
        frame("down"); frame("down");
        assert.equal(state.repetitions, 0);
        frame("forward", false); frame("forward", false);
        assert.equal(state.repetitions, 0);
        assert.notEqual(state.phase, "top");
        frame("forward"); frame("forward");
        assert.equal(state.phase, "top");
        frame("down");
        const completed = frame("down");
        assert.equal(completed.state.repetitions, 1);
        assert.equal(completed.justCompletedRepetition, true);
    });

    test(`${side}: abduction counts a sideways raise, not a forward raise`, () => {
        let state = INITIAL_SHOULDER_ABDUCTION_STATE;
        const frame = (direction: Direction, withWorld = true) => {
            const current = pose(side, direction);
            const snapshot = updateShoulderAbductionGuidance(
                state,
                current.image,
                side,
                withWorld ? current.world : null,
            );
            state = snapshot.state;
            return snapshot;
        };
        frame("down"); frame("down");
        frame("forward");
        const wrong = frame("forward");
        assert.equal(wrong.state.phase, "raising");
        assert.ok(wrong.activeIssues.some((issue) => issue.id === "target-arm-direction"));
        frame("down"); frame("down");
        assert.equal(state.repetitions, 0);
        frame("sideways", false); frame("sideways", false);
        assert.notEqual(state.phase, "top");
        frame("sideways"); frame("sideways");
        assert.equal(state.phase, "top");
        frame("down");
        const completed = frame("down");
        assert.equal(completed.state.repetitions, 1);
        assert.equal(completed.justCompletedRepetition, true);
    });

    test(`${side}: losing direction at the top cancels the pending repetition`, () => {
        const down = pose(side, "down");
        const forward = pose(side, "forward");
        const sideways = pose(side, "sideways");
        let flexion = INITIAL_SHOULDER_FLEXION_STATE;
        for (const current of [down, down, forward, forward, sideways, down, down]) {
            flexion = updateShoulderFlexionGuidance(flexion, current.image, side, current.world).state;
        }
        assert.equal(flexion.repetitions, 0);

        let abduction = INITIAL_SHOULDER_ABDUCTION_STATE;
        for (const current of [down, down, sideways, sideways, forward, down, down]) {
            abduction = updateShoulderAbductionGuidance(abduction, current.image, side, current.world).state;
        }
        assert.equal(abduction.repetitions, 0);
    });

    test(`${side}: the non-target elbow need not be visible`, () => {
        const down = pose(side, "down");
        const forward = pose(side, "forward");
        const sideways = pose(side, "sideways");
        const otherElbow = side === "left" ? "rightElbow" : "leftElbow";
        for (const current of [down, forward, sideways]) {
            current.image[otherElbow]!.visibility = 0;
        }
        let flexion = INITIAL_SHOULDER_FLEXION_STATE;
        for (const current of [down, down, forward, forward, down, down]) {
            flexion = updateShoulderFlexionGuidance(flexion, current.image, side, current.world).state;
        }
        assert.equal(flexion.repetitions, 1);
        let abduction = INITIAL_SHOULDER_ABDUCTION_STATE;
        for (const current of [down, down, sideways, sideways, down, down]) {
            abduction = updateShoulderAbductionGuidance(abduction, current.image, side, current.world).state;
        }
        assert.equal(abduction.repetitions, 1);
    });
}
