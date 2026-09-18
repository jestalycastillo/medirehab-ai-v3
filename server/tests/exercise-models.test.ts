import assert from "node:assert/strict";
import { resolveExerciseAnalysisModel } from "../src/utils/exerciseAnalysisModel";
import { HttpError } from "../src/utils/httpError";

for (const movement of ["flexion", "abduction"] as const) {
    for (const side of ["left", "right"] as const) {
        assert.deepEqual(resolveExerciseAnalysisModel(`shoulder_${movement}`, side), {
            evaluatedModelKey: `${side}_${movement}`,
            selectedSide: side
        });
        assert.deepEqual(resolveExerciseAnalysisModel(`${side}_${movement}`), {
            evaluatedModelKey: `${side}_${movement}`,
            selectedSide: side
        });
    }
    assert.throws(
        () => resolveExerciseAnalysisModel(`shoulder_${movement}`),
        (error) => error instanceof HttpError && error.statusCode === 400
    );
}

assert.throws(
    () => resolveExerciseAnalysisModel("right_flexion", "left"),
    (error) => error instanceof HttpError && error.statusCode === 400
);

console.log("Exercise analysis model routing passed.");
