"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import {
    INITIAL_SIDE_ARMS_RAISE_STATE,
    updateSideArmsRaiseGuidance,
    type SideArmsRaiseGuidanceEvent,
    type SideArmsRaiseGuidanceIssue,
    type SideArmsRaiseGuidanceState,
} from "@/lib/pose/side-arms-raise-guidance";
import {
    getCameraFramingKeyPointVisibility,
    getRequiredExerciseKeyPointVisibility,
    type ExerciseKeyPointVisibility,
} from "@/lib/pose/exercise-key-points";
import {
    INITIAL_GUIDANCE_DISPLAY_STATE,
    stabilizeGuidanceMessage,
    type GuidanceDisplayState,
} from "@/lib/pose/live-guidance-stabilizer";
import type {
    PoseWorkerRequest,
    PoseWorkerResponse,
} from "@/lib/pose/pose-landmarker.types";

const TARGET_FRAME_INTERVAL_MS = 100;
const WASM_BASE_PATH = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm";
const MODEL_ASSET_PATH = "/models/pose_landmarker_lite.task";

type LiveGuidanceStatus = "disabled" | "loading" | "ready" | "error";
type LiveGuidanceMode = "framing" | "exercise";

const FRAMING_PROMPT = "Move back until your head, shoulders, and feet are visible.";

function getFramingMessage(points: ExerciseKeyPointVisibility[]): string {
    const missing = new Set(points.filter((point) => !point.isVisible).map((point) => point.id));
    if (missing.size === points.length) return "Move into view of the camera.";
    if (missing.has("leftAnkle") || missing.has("rightAnkle")) {
        return "Step back until both feet are visible.";
    }
    if (missing.has("nose")) return "Adjust the camera so your head is visible.";
    if (missing.has("leftShoulder") || missing.has("rightShoulder")) {
        return "Move to the center so both shoulders are visible.";
    }
    if (missing.has("leftHip") || missing.has("rightHip")) {
        return "Move into frame so your hips are visible.";
    }
    return "Your full body is in frame. Start recording when you’re ready.";
}

interface LiveGuidanceView {
    mode: LiveGuidanceMode;
    status: LiveGuidanceStatus;
    message: string;
    repetitions: number;
    hasReliablePose: boolean;
    justCompletedRepetition: boolean;
    keyPoints: ExerciseKeyPointVisibility[];
    activeIssues: SideArmsRaiseGuidanceIssue[];
    resolvedIssues: SideArmsRaiseGuidanceIssue[];
    recentGuidanceEvents: SideArmsRaiseGuidanceEvent[];
}

const DISABLED_VIEW: LiveGuidanceView = {
    mode: "exercise",
    status: "disabled",
    message: "",
    repetitions: 0,
    hasReliablePose: false,
    justCompletedRepetition: false,
    keyPoints: [],
    activeIssues: [],
    resolvedIssues: [],
    recentGuidanceEvents: [],
};

const LOADING_VIEW: LiveGuidanceView = {
    mode: "exercise",
    status: "loading",
    message: "Preparing live guidance…",
    repetitions: 0,
    hasReliablePose: false,
    justCompletedRepetition: false,
    keyPoints: getRequiredExerciseKeyPointVisibility("Side Arms Raise", null),
    activeIssues: [],
    resolvedIssues: [],
    recentGuidanceEvents: [],
};

const FRAMING_LOADING_VIEW: LiveGuidanceView = {
    ...LOADING_VIEW,
    mode: "framing",
    message: "Checking your position…",
    keyPoints: getCameraFramingKeyPointVisibility(null),
};

export function useSideArmsRaiseGuidance(
    enabled: boolean,
    videoRef: RefObject<HTMLVideoElement | null>,
    mode: LiveGuidanceMode = "exercise",
): LiveGuidanceView {
    const [view, setView] = useState<LiveGuidanceView>(DISABLED_VIEW);
    const guidanceStateRef = useRef<SideArmsRaiseGuidanceState>(INITIAL_SIDE_ARMS_RAISE_STATE);
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

        guidanceStateRef.current = INITIAL_SIDE_ARMS_RAISE_STATE;
        guidanceDisplayRef.current = INITIAL_GUIDANCE_DISPLAY_STATE;
        const resetViewFrameId = window.requestAnimationFrame(() =>
            setView(mode === "framing" ? FRAMING_LOADING_VIEW : LOADING_VIEW),
        );

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
                status: "error",
                message: mode === "framing"
                    ? "Position checking is unavailable. You can still preview and record."
                    : "Live guidance is unavailable. Recording still works.",
                repetitions: mode === "framing" ? 0 : guidanceStateRef.current.repetitions,
                hasReliablePose: false,
                justCompletedRepetition: false,
                keyPoints: mode === "framing"
                    ? getCameraFramingKeyPointVisibility(null)
                    : getRequiredExerciseKeyPointVisibility("Side Arms Raise", null),
                activeIssues: [],
                resolvedIssues: [],
                recentGuidanceEvents: mode === "framing" ? [] : guidanceStateRef.current.recentGuidanceEvents,
            });
        };

        worker.onmessage = (event: MessageEvent<PoseWorkerResponse>) => {
            if (disposed) return;

            if (event.data.type === "ready") {
                workerReady = true;
                const message = mode === "framing"
                    ? FRAMING_PROMPT
                    : "Move fully into the frame so both shoulders and elbows are visible.";
                guidanceDisplayRef.current = stabilizeGuidanceMessage(
                    guidanceDisplayRef.current,
                    message,
                    performance.now(),
                    true,
                );
                setView({
                    mode,
                    status: "ready",
                    message,
                    repetitions: 0,
                    hasReliablePose: false,
                    justCompletedRepetition: false,
                    keyPoints: mode === "framing"
                        ? getCameraFramingKeyPointVisibility(null)
                        : getRequiredExerciseKeyPointVisibility("Side Arms Raise", null),
                    activeIssues: [],
                    resolvedIssues: [],
                    recentGuidanceEvents: guidanceStateRef.current.recentGuidanceEvents,
                });
                return;
            }

            if (event.data.type === "error") {
                failGuidance();
                return;
            }

            framePending = false;
            if (mode === "framing") {
                const keyPoints = getCameraFramingKeyPointVisibility(event.data.landmarks);
                const message = getFramingMessage(keyPoints);
                guidanceDisplayRef.current = stabilizeGuidanceMessage(
                    guidanceDisplayRef.current,
                    message,
                    performance.now(),
                    false,
                );
                setView({
                    mode,
                    status: "ready",
                    message: guidanceDisplayRef.current.displayedMessage,
                    repetitions: 0,
                    hasReliablePose: keyPoints.every((point) => point.isVisible),
                    justCompletedRepetition: false,
                    keyPoints,
                    activeIssues: [],
                    resolvedIssues: [],
                    recentGuidanceEvents: [],
                });
                return;
            }
            const snapshot = updateSideArmsRaiseGuidance(
                guidanceStateRef.current,
                event.data.landmarks,
            );
            guidanceStateRef.current = snapshot.state;
            guidanceDisplayRef.current = stabilizeGuidanceMessage(
                guidanceDisplayRef.current,
                snapshot.message,
                performance.now(),
                !snapshot.hasReliablePose || snapshot.justCompletedRepetition,
            );
            setView({
                mode,
                status: "ready",
                message: guidanceDisplayRef.current.displayedMessage,
                repetitions: snapshot.state.repetitions,
                hasReliablePose: snapshot.hasReliablePose,
                justCompletedRepetition: snapshot.justCompletedRepetition,
                keyPoints: snapshot.keyPoints,
                activeIssues: snapshot.activeIssues,
                resolvedIssues: snapshot.resolvedIssues,
                recentGuidanceEvents: snapshot.recentGuidanceEvents,
            });
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
    }, [enabled, mode, videoRef]);

    if (!enabled) return DISABLED_VIEW;
    return view.status === "disabled" || view.mode !== mode
        ? mode === "framing" ? FRAMING_LOADING_VIEW : LOADING_VIEW
        : view;
}
