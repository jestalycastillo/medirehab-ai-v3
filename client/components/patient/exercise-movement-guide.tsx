"use client";

import { AnimatedExerciseGuide } from "./animated-exercise-guide";
import { getNewExerciseInstructions } from "@/lib/pose/exercise-model-config";

type Props = React.ComponentProps<typeof AnimatedExerciseGuide>;

export function ExerciseMovementGuide(props: Props) {
    const instructions = getNewExerciseInstructions(props.analysisModelKey, props.exerciseName);
    if (!instructions) return <AnimatedExerciseGuide {...props} />;
    return (
        <div role="note" aria-label={`${props.exerciseName} movement instructions`} style={{ padding: "18px", color: "#0f172a", background: "#ffffff", lineHeight: 1.6 }}>
            <strong>{props.exerciseName}</strong>
            {props.selectedSide && <p style={{ margin: "6px 0" }}>Selected arm: {props.selectedSide === "left" ? "Left" : "Right"}</p>}
            <p style={{ margin: "8px 0" }}>{instructions}</p>
        </div>
    );
}
