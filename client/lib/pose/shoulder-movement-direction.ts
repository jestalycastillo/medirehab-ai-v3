import type { PoseWorldLandmarkMap, PoseWorldPoint } from "./pose-landmarker.types";

export type ShoulderMovementDirection = "forward" | "sideways" | "uncertain";

// World landmarks are model estimates, so only accept a direction when one axis
// clearly dominates. Ambiguous or missing depth must not confirm a repetition.
export function classifyShoulderMovementDirection(
    landmarks: PoseWorldLandmarkMap | null,
    side: "left" | "right",
): ShoulderMovementDirection {
    const shoulder = landmarks?.[side === "left" ? "leftShoulder" : "rightShoulder"];
    const elbow = landmarks?.[side === "left" ? "leftElbow" : "rightElbow"];
    if (!isReliableWorldPoint(shoulder) || !isReliableWorldPoint(elbow)) {
        return "uncertain";
    }

    const horizontal = Math.abs(elbow.x - shoulder.x);
    const depth = shoulder.z - elbow.z;
    const vertical = Math.abs(elbow.y - shoulder.y);
    const armLength = Math.hypot(horizontal, depth, vertical);
    if (armLength < 0.05) return "uncertain";

    // In the camera-facing setup, forward flexion brings the elbow toward the
    // camera (smaller z); lateral abduction separates it horizontally.
    if (depth >= armLength * 0.45 && depth > horizontal * 1.25) {
        return "forward";
    }
    if (horizontal >= armLength * 0.45 && horizontal > Math.abs(depth) * 1.25) {
        return "sideways";
    }
    return "uncertain";
}

function isReliableWorldPoint(point: PoseWorldPoint | undefined): point is PoseWorldPoint {
    return Boolean(
        point
        && point.visibility >= 0.6
        && Number.isFinite(point.x)
        && Number.isFinite(point.y)
        && Number.isFinite(point.z),
    );
}
