"use client";

import { AnimatedExerciseGuide } from "./animated-exercise-guide";
import { useEffect, useRef } from "react";
import { getExerciseDemoVideoUrl, getExerciseIllustrationUrl, getNewExerciseInstructions } from "@/lib/pose/exercise-model-config";

type Props = React.ComponentProps<typeof AnimatedExerciseGuide>;

function ExerciseDemo(props: Props) {
    const video = useRef<HTMLVideoElement>(null);
    const src = getExerciseDemoVideoUrl(props.exerciseName, props.selectedSide, props.analysisModelKey);
    useEffect(() => {
        if (!video.current) return;
        video.current.playbackRate = props.speed ?? 1;
        if (props.isCountingDown) video.current.pause();
        else void video.current.play().catch(() => { /* Playback controls remain available. */ });
    }, [props.speed, props.isCountingDown, src]);
    return <video key={src} ref={video} src={src}
        poster={getExerciseIllustrationUrl(props.analysisModelKey, props.exerciseName) ?? undefined}
        aria-label={`${props.exerciseName}${props.selectedSide ? ` (${props.selectedSide} arm)` : ""} demonstration`}
        muted loop playsInline autoPlay={!props.isCountingDown} controls={!props.isRecording}
        preload="metadata" style={{ width: "100%", maxHeight: props.isRecording ? 220 : 360, objectFit: "contain" }} />;
}

export function ExerciseMovementGuide(props: Props) {
    const instructions = getNewExerciseInstructions(props.analysisModelKey, props.exerciseName);
    if (!instructions) return <AnimatedExerciseGuide {...props} />;
    return (
        <div aria-label={`${props.exerciseName} movement instructions`} style={{ padding: "18px", color: "#0f172a", background: "#ffffff", lineHeight: 1.6 }}>
            <ExerciseDemo {...props} />
            <strong>{props.exerciseName}</strong>
            {props.selectedSide && <p style={{ margin: "6px 0" }}>Selected arm: {props.selectedSide === "left" ? "Left" : "Right"}</p>}
            <p style={{ margin: "8px 0" }}>{instructions}</p>
        </div>
    );
}
