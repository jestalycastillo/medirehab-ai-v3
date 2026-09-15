"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import {
    INITIAL_SIDE_ARMS_RAISE_STATE,
    updateSideArmsRaiseGuidance,
    supportsSideArmsRaiseGuidance,
    type SideArmsRaiseGuidanceEvent,
    type SideArmsRaiseGuidanceIssue,
    type SideArmsRaiseGuidanceState,
} from "@/lib/pose/side-arms-raise-guidance";
import {
    INITIAL_SHOULDER_FLEXION_STATE,
    updateShoulderFlexionGuidance,
    supportsShoulderFlexionGuidance,
    type ShoulderFlexionGuidanceEvent,
    type ShoulderFlexionGuidanceIssue,
    type ShoulderFlexionGuidanceState,
} from "@/lib/pose/shoulder-flexion-guidance";
import {
    INITIAL_SHOULDER_ABDUCTION_STATE,
    updateShoulderAbductionGuidance,
    supportsShoulderAbductionGuidance,
    type ShoulderAbductionGuidanceEvent,
    type ShoulderAbductionGuidanceIssue,
    type ShoulderAbductionGuidanceState,
} from "@/lib/pose/shoulder-abduction-guidance";
import {
    getRequiredExerciseKeyPointVisibility,
    type ExerciseKeyPointVisibility,
} from "@/lib/pose/exercise-key-points";
import {
    INITIAL_GUIDANCE_DISPLAY_STATE,
    stabilizeGuidanceMessage,
    type GuidanceDisplayState,
} from "@/lib/pose/live-guidance-stabilizer";
import type {
    PoseLandmarkMap,
    PoseWorldLandmarkMap,
    PoseWorkerRequest,
    PoseWorkerResponse,
} from "@/lib/pose/pose-landmarker.types";

const TARGET_FRAME_INTERVAL_MS = 100;
const WASM_BASE_PATH = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm";
const MODEL_ASSET_PATH = "/models/pose_landmarker_lite.task";

type LiveGuidanceStatus = "disabled" | "loading" | "ready" | "error";
type LiveGuidanceMode = "framing" | "exercise";

const FRAMING_PROMPT = "Move into frame until the required body points are visible.";

function getFramingMessage(points: ExerciseKeyPointVisibility[]): string {
    const missing = points.filter((point) => !point.isVisible);
    if (missing.length === points.length) return FRAMING_PROMPT;
    if (missing.length === 0) {
        return "The required body points are visible. Start recording when you’re ready.";
    }

    const labels = missing.map((point) => point.label.toLowerCase());
    const missingLabels = labels.length === 1
        ? labels[0]
        : `${labels.slice(0, -1).join(", ")} and ${labels.at(-1)}`;
    return `Adjust your position so your ${missingLabels} ${missing.length === 1 ? "is" : "are"} visible.`;
}

export type LiveGuidanceIssue = SideArmsRaiseGuidanceIssue | ShoulderFlexionGuidanceIssue | ShoulderAbductionGuidanceIssue;
export type LiveGuidanceEvent = SideArmsRaiseGuidanceEvent | ShoulderFlexionGuidanceEvent | ShoulderAbductionGuidanceEvent;

export interface LiveGuidanceView {
    mode: LiveGuidanceMode;
    exerciseName: string;
    status: LiveGuidanceStatus;
    message: string;
    repetitions: number;
    hasReliablePose: boolean;
    justCompletedRepetition: boolean;
    keyPoints: ExerciseKeyPointVisibility[];
    activeIssues: LiveGuidanceIssue[];
    resolvedIssues: LiveGuidanceIssue[];
    recentGuidanceEvents: LiveGuidanceEvent[];
    landmarks: PoseLandmarkMap | null;
    worldLandmarks: PoseWorldLandmarkMap | null;
}

const DISABLED_VIEW: LiveGuidanceView = {
    mode: "exercise",
    exerciseName: "Side Arms Raise",
    status: "disabled",
    message: "",
    repetitions: 0,
    hasReliablePose: false,
    justCompletedRepetition: false,
    keyPoints: [],
    activeIssues: [],
    resolvedIssues: [],
    recentGuidanceEvents: [],
    landmarks: null,
    worldLandmarks: null,
};

export function supportsExerciseLiveGuidance(exerciseName: string): boolean {
    return (
        supportsSideArmsRaiseGuidance(exerciseName) ||
        supportsShoulderFlexionGuidance(exerciseName) ||
        supportsShoulderAbductionGuidance(exerciseName)
    );
}

function getLoadingView(
    mode: LiveGuidanceMode,
    exerciseName: string,
    selectedSide: "left" | "right",
): LiveGuidanceView {
    return {
        ...DISABLED_VIEW,
        mode,
        exerciseName,
        status: "loading",
        message: mode === "framing" ? "Checking your position…" : "Preparing live guidance…",
        keyPoints: getRequiredExerciseKeyPointVisibility(exerciseName, null, undefined, selectedSide),
    };
}

export function useSideArmsRaiseGuidance(
    enabled: boolean,
    videoRef: RefObject<HTMLVideoElement | null>,
    exerciseName = "Side Arms Raise",
    selectedSide: "left" | "right" = "left",
    mode: LiveGuidanceMode = "exercise",
): LiveGuidanceView {
    const isFlexion = supportsShoulderFlexionGuidance(exerciseName);
    const isAbduction = supportsShoulderAbductionGuidance(exerciseName);
    const [view, setView] = useState<LiveGuidanceView>(DISABLED_VIEW);

    const sideArmsStateRef = useRef<SideArmsRaiseGuidanceState>(INITIAL_SIDE_ARMS_RAISE_STATE);
    const flexionStateRef = useRef<ShoulderFlexionGuidanceState>(INITIAL_SHOULDER_FLEXION_STATE);
    const abductionStateRef = useRef<ShoulderAbductionGuidanceState>(INITIAL_SHOULDER_ABDUCTION_STATE);
    const guidanceDisplayRef = useRef<GuidanceDisplayState>(INITIAL_GUIDANCE_DISPLAY_STATE);

    useEffect(() => {
        if (!enabled) {
            return;
        }

        let disposed = false;
        let framePending = false;
        let workerReady = false;
        let lastFrameTime = 0;
        let animationFrameId = 0;

        sideArmsStateRef.current = INITIAL_SIDE_ARMS_RAISE_STATE;
        flexionStateRef.current = INITIAL_SHOULDER_FLEXION_STATE;
        abductionStateRef.current = INITIAL_SHOULDER_ABDUCTION_STATE;
        guidanceDisplayRef.current = INITIAL_GUIDANCE_DISPLAY_STATE;

        const initialKeyPoints = getRequiredExerciseKeyPointVisibility(
            exerciseName,
            null,
            undefined,
            selectedSide,
        );

        const loadingView = getLoadingView(mode, exerciseName, selectedSide);

        const resetViewFrameId = window.requestAnimationFrame(() => setView(loadingView));

        const worker = new Worker(
            new URL("../workers/pose-landmarker.worker.ts", import.meta.url),
            { type: "module" },
        );

        const failGuidance = () => {
            if (disposed) return;
            workerReady = false;
            framePending = false;
            setView({
                mode,
                exerciseName,
                status: "error",
                message: mode === "framing"
                    ? "Position checking is unavailable. You can still preview and record."
                    : "Live guidance is unavailable. Recording still works.",
                repetitions: mode === "framing" ? 0 : isFlexion
                    ? flexionStateRef.current.repetitions
                    : isAbduction
                        ? abductionStateRef.current.repetitions
                        : sideArmsStateRef.current.repetitions,
                hasReliablePose: false,
                justCompletedRepetition: false,
                keyPoints: initialKeyPoints,
                activeIssues: [],
                resolvedIssues: [],
                recentGuidanceEvents: mode === "framing" ? [] : isFlexion
                    ? flexionStateRef.current.recentGuidanceEvents
                    : isAbduction
                        ? abductionStateRef.current.recentGuidanceEvents
                        : sideArmsStateRef.current.recentGuidanceEvents,
                landmarks: null,
                worldLandmarks: null,
            });
        };

        worker.onmessage = (event: MessageEvent<PoseWorkerResponse>) => {
            if (disposed) return;

            if (event.data.type === "ready") {
                workerReady = true;
                const message = mode === "framing"
                    ? FRAMING_PROMPT
                    : isFlexion || isAbduction
                    ? `Move fully into the frame so your shoulders and ${selectedSide} arm are visible.`
                    : "Move fully into the frame so both shoulders and elbows are visible.";
                guidanceDisplayRef.current = stabilizeGuidanceMessage(
                    guidanceDisplayRef.current,
                    message,
                    performance.now(),
                    true,
                );
                setView({
                    mode,
                    exerciseName,
                    status: "ready",
                    message,
                    repetitions: 0,
                    hasReliablePose: false,
                    justCompletedRepetition: false,
                    keyPoints: initialKeyPoints,
                    activeIssues: [],
                    resolvedIssues: [],
                    recentGuidanceEvents: [],
                    landmarks: null,
                    worldLandmarks: null,
                });
                return;
            }

            if (event.data.type === "error") {
                failGuidance();
                return;
            }

            framePending = false;
            const currentLandmarks = event.data.landmarks ?? null;
            const currentWorldLandmarks = event.data.worldLandmarks ?? null;

            if (mode === "framing") {
                const keyPoints = getRequiredExerciseKeyPointVisibility(
                    exerciseName,
                    currentLandmarks,
                    undefined,
                    selectedSide,
                );
                guidanceDisplayRef.current = stabilizeGuidanceMessage(
                    guidanceDisplayRef.current,
                    getFramingMessage(keyPoints),
                    performance.now(),
                    false,
                );
                setView({
                    mode,
                    exerciseName,
                    status: "ready",
                    message: guidanceDisplayRef.current.displayedMessage,
                    repetitions: 0,
                    hasReliablePose: keyPoints.every((point) => point.isVisible),
                    justCompletedRepetition: false,
                    keyPoints,
                    activeIssues: [],
                    resolvedIssues: [],
                    recentGuidanceEvents: [],
                    landmarks: currentLandmarks,
                    worldLandmarks: currentWorldLandmarks,
                });
                return;
            }
            if (isFlexion) {
                const snapshot = updateShoulderFlexionGuidance(
                    flexionStateRef.current,
                    currentLandmarks,
                    selectedSide,
                    currentWorldLandmarks,
                );
                flexionStateRef.current = snapshot.state;
                guidanceDisplayRef.current = stabilizeGuidanceMessage(
                    guidanceDisplayRef.current,
                    snapshot.message,
                    performance.now(),
                    !snapshot.hasReliablePose || snapshot.justCompletedRepetition,
                );
                setView({
                    mode,
                    exerciseName,
                    status: "ready",
                    message: guidanceDisplayRef.current.displayedMessage,
                    repetitions: snapshot.state.repetitions,
                    hasReliablePose: snapshot.hasReliablePose,
                    justCompletedRepetition: snapshot.justCompletedRepetition,
                    keyPoints: snapshot.keyPoints,
                    activeIssues: snapshot.activeIssues,
                    resolvedIssues: snapshot.resolvedIssues,
                    recentGuidanceEvents: snapshot.recentGuidanceEvents,
                    landmarks: currentLandmarks,
                    worldLandmarks: currentWorldLandmarks,
                });
            } else if (isAbduction) {
                const snapshot = updateShoulderAbductionGuidance(
                    abductionStateRef.current,
                    currentLandmarks,
                    selectedSide,
                    currentWorldLandmarks,
                );
                abductionStateRef.current = snapshot.state;
                guidanceDisplayRef.current = stabilizeGuidanceMessage(
                    guidanceDisplayRef.current,
                    snapshot.message,
                    performance.now(),
                    !snapshot.hasReliablePose || snapshot.justCompletedRepetition,
                );
                setView({
                    mode,
                    exerciseName,
                    status: "ready",
                    message: guidanceDisplayRef.current.displayedMessage,
                    repetitions: snapshot.state.repetitions,
                    hasReliablePose: snapshot.hasReliablePose,
                    justCompletedRepetition: snapshot.justCompletedRepetition,
                    keyPoints: snapshot.keyPoints,
                    activeIssues: snapshot.activeIssues,
                    resolvedIssues: snapshot.resolvedIssues,
                    recentGuidanceEvents: snapshot.recentGuidanceEvents,
                    landmarks: currentLandmarks,
                    worldLandmarks: currentWorldLandmarks,
                });
            } else {
                const snapshot = updateSideArmsRaiseGuidance(
                    sideArmsStateRef.current,
                    currentLandmarks,
                );
                sideArmsStateRef.current = snapshot.state;
                guidanceDisplayRef.current = stabilizeGuidanceMessage(
                    guidanceDisplayRef.current,
                    snapshot.message,
                    performance.now(),
                    !snapshot.hasReliablePose || snapshot.justCompletedRepetition,
                );
                setView({
                    mode,
                    exerciseName,
                    status: "ready",
                    message: guidanceDisplayRef.current.displayedMessage,
                    repetitions: snapshot.state.repetitions,
                    hasReliablePose: snapshot.hasReliablePose,
                    justCompletedRepetition: snapshot.justCompletedRepetition,
                    keyPoints: snapshot.keyPoints,
                    activeIssues: snapshot.activeIssues,
                    resolvedIssues: snapshot.resolvedIssues,
                    recentGuidanceEvents: snapshot.recentGuidanceEvents,
                    landmarks: currentLandmarks,
                    worldLandmarks: currentWorldLandmarks,
                });
            }
        };

        worker.onerror = failGuidance;

        const initMessage: PoseWorkerRequest = {
            type: "init",
            modelAssetPath: new URL(MODEL_ASSET_PATH, window.location.origin).toString(),
            wasmBasePath: WASM_BASE_PATH,
        };
        worker.postMessage(initMessage);

        const sampleVideo = (now: number) => {
            animationFrameId = window.requestAnimationFrame(sampleVideo);
            const video = videoRef.current;
            if (
                disposed ||
                !workerReady ||
                framePending ||
                !video ||
                video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA ||
                now - lastFrameTime < TARGET_FRAME_INTERVAL_MS
            ) {
                return;
            }

            framePending = true;
            lastFrameTime = now;
            createImageBitmap(video)
                .then((bitmap) => {
                    if (disposed) {
                        bitmap.close();
                        return;
                    }
                    const frameMessage: PoseWorkerRequest = {
                        type: "frame",
                        bitmap,
                        timestamp: now,
                    };
                    worker.postMessage(frameMessage, [bitmap]);
                })
                .catch(() => {
                    framePending = false;
                    failGuidance();
                });
        };

        animationFrameId = window.requestAnimationFrame(sampleVideo);

        return () => {
            disposed = true;
            window.cancelAnimationFrame(resetViewFrameId);
            window.cancelAnimationFrame(animationFrameId);
            const closeMessage: PoseWorkerRequest = { type: "close" };
            worker.postMessage(closeMessage);
            worker.terminate();
        };
    }, [enabled, videoRef, exerciseName, isFlexion, isAbduction, selectedSide, mode]);

    if (!enabled) return DISABLED_VIEW;
    return view.status === "disabled" || view.mode !== mode || view.exerciseName !== exerciseName
        ? getLoadingView(mode, exerciseName, selectedSide)
        : view;
}
