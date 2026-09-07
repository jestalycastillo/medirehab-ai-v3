import { FilesetResolver, PoseLandmarker } from "@mediapipe/tasks-vision";
import type {
    PoseLandmarkKey,
    PoseLandmarkMap,
    PosePoint,
    PoseWorkerRequest,
    PoseWorkerResponse,
} from "@/lib/pose/pose-landmarker.types";

const LANDMARK_INDEXES: Record<PoseLandmarkKey, number> = {
    nose: 0,
    leftShoulder: 11,
    rightShoulder: 12,
    leftElbow: 13,
    rightElbow: 14,
    leftWrist: 15,
    rightWrist: 16,
    leftHip: 23,
    rightHip: 24,
    leftKnee: 25,
    rightKnee: 26,
    leftAnkle: 27,
    rightAnkle: 28,
};

const workerScope = self as unknown as {
    onmessage: ((event: MessageEvent<PoseWorkerRequest>) => void) | null;
    postMessage: (message: PoseWorkerResponse) => void;
    close: () => void;
};

let poseLandmarker: PoseLandmarker | null = null;

workerScope.onmessage = async (event) => {
    const request = event.data;

    if (request.type === "close") {
        poseLandmarker?.close();
        poseLandmarker = null;
        workerScope.close();
        return;
    }

    if (request.type === "init") {
        try {
            const vision = await FilesetResolver.forVisionTasks(request.wasmBasePath);
            poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
                baseOptions: {
                    modelAssetPath: request.modelAssetPath,
                    delegate: "CPU",
                },
                runningMode: "VIDEO",
                numPoses: 1,
                minPoseDetectionConfidence: 0.6,
                minPosePresenceConfidence: 0.6,
                minTrackingConfidence: 0.6,
                outputSegmentationMasks: false,
            });
            workerScope.postMessage({ type: "ready" });
        } catch (error) {
            workerScope.postMessage({
                type: "error",
                message: error instanceof Error ? error.message : "Unable to initialize pose tracking.",
            });
        }
        return;
    }

    if (!poseLandmarker) {
        request.bitmap.close();
        workerScope.postMessage({ type: "error", message: "Pose tracking is not ready." });
        return;
    }

    try {
        const result = poseLandmarker.detectForVideo(request.bitmap, request.timestamp);
        const pose = result.landmarks[0];
        workerScope.postMessage({
            type: "result",
            landmarks: pose ? selectBodyLandmarks(pose) : null,
        });
    } catch (error) {
        workerScope.postMessage({
            type: "error",
            message: error instanceof Error ? error.message : "Pose tracking failed.",
        });
    } finally {
        request.bitmap.close();
    }
};

function selectBodyLandmarks(
    landmarks: Array<{ x: number; y: number; visibility?: number }>,
): PoseLandmarkMap {
    return Object.fromEntries(
        Object.entries(LANDMARK_INDEXES).map(([key, index]) => [
            key,
            toPosePoint(landmarks[index]),
        ]),
    ) as PoseLandmarkMap;
}

function toPosePoint(landmark?: { x: number; y: number; visibility?: number }): PosePoint {
    return {
        x: landmark?.x ?? 0,
        y: landmark?.y ?? 0,
        visibility: landmark?.visibility ?? 0,
    };
}
