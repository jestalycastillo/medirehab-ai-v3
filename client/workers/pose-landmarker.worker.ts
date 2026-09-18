import { FilesetResolver, PoseLandmarker } from "@mediapipe/tasks-vision";
import type {
    PoseLandmarkKey,
    PoseLandmarkMap,
    PosePoint,
    PoseWorldLandmarkMap,
    PoseWorldPoint,
    PoseWorkerRequest,
    PoseWorkerResponse,
} from "@/lib/pose/pose-landmarker.types";

const LANDMARK_INDEXES: Record<Exclude<PoseLandmarkKey, "chest">, number> = {
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
        const worldPose = result.worldLandmarks[0];
        workerScope.postMessage({
            type: "result",
            landmarks: pose ? selectBodyLandmarks(pose) : null,
            worldLandmarks: worldPose ? selectWorldLandmarks(worldPose) : null,
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
    const landmarkMap = Object.fromEntries(
        Object.entries(LANDMARK_INDEXES).map(([key, index]) => [
            key,
            toPosePoint(landmarks[index]),
        ]),
    ) as PoseLandmarkMap;

    const leftShoulder = landmarkMap.leftShoulder;
    const rightShoulder = landmarkMap.rightShoulder;

    if (leftShoulder && rightShoulder) {
        const span = Math.hypot(leftShoulder.x - rightShoulder.x, leftShoulder.y - rightShoulder.y);
        const chestX = (leftShoulder.x + rightShoulder.x) / 2;
        const chestY = (leftShoulder.y + rightShoulder.y) / 2;

        // Chest is only visible if both shoulders are genuinely inside the frame (0.05 to 0.95),
        // shoulder span is anatomically meaningful (> 0.08 of frame), and both have confident visibility
        const isChestInBounds = chestX >= 0.05 && chestX <= 0.95 && chestY >= 0.05 && chestY <= 0.95;
        const areShouldersInFrame = leftShoulder.y >= 0.05 && leftShoulder.y <= 0.95 && rightShoulder.y >= 0.05 && rightShoulder.y <= 0.95;
        const areShouldersValid =
            leftShoulder.visibility >= 0.65 &&
            rightShoulder.visibility >= 0.65 &&
            span >= 0.08 &&
            isChestInBounds &&
            areShouldersInFrame;

        landmarkMap.chest = {
            x: chestX,
            y: chestY,
            visibility: areShouldersValid ? Math.min(leftShoulder.visibility, rightShoulder.visibility) : 0,
        };
    }

    return landmarkMap;
}

function toPosePoint(landmark?: { x: number; y: number; visibility?: number }): PosePoint {
    return {
        x: landmark?.x ?? 0,
        y: landmark?.y ?? 0,
        visibility: landmark?.visibility ?? 0,
    };
}

function selectWorldLandmarks(
    landmarks: Array<{ x: number; y: number; z: number; visibility?: number }>,
): PoseWorldLandmarkMap {
    const worldMap = Object.fromEntries(
        Object.entries(LANDMARK_INDEXES).map(([key, index]) => [
            key,
            toWorldPoint(landmarks[index]),
        ]),
    ) as PoseWorldLandmarkMap;

    const leftShoulder = worldMap.leftShoulder;
    const rightShoulder = worldMap.rightShoulder;

    if (leftShoulder && rightShoulder) {
        worldMap.chest = {
            x: (leftShoulder.x + rightShoulder.x) / 2,
            y: (leftShoulder.y + rightShoulder.y) / 2,
            z: (leftShoulder.z + rightShoulder.z) / 2,
            visibility: Math.min(leftShoulder.visibility, rightShoulder.visibility),
        };
    }

    return worldMap;
}

function toWorldPoint(landmark?: { x: number; y: number; z: number; visibility?: number }): PoseWorldPoint {
    return {
        x: landmark?.x ?? 0,
        y: landmark?.y ?? 0,
        z: landmark?.z ?? 0,
        visibility: landmark?.visibility ?? 0,
    };
}
