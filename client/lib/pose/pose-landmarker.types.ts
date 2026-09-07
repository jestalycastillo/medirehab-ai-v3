export interface PosePoint {
    x: number;
    y: number;
    visibility: number;
}

export type PoseLandmarkKey =
    | "nose"
    | "leftShoulder"
    | "rightShoulder"
    | "leftElbow"
    | "rightElbow"
    | "leftWrist"
    | "rightWrist"
    | "leftHip"
    | "rightHip"
    | "leftKnee"
    | "rightKnee"
    | "leftAnkle"
    | "rightAnkle";

export type PoseLandmarkMap = Partial<Record<PoseLandmarkKey, PosePoint>>;

export interface UpperBodyLandmarks extends PoseLandmarkMap {
    leftShoulder: PosePoint;
    rightShoulder: PosePoint;
    leftElbow: PosePoint;
    rightElbow: PosePoint;
}

export type PoseWorkerRequest =
    | {
          type: "init";
          modelAssetPath: string;
          wasmBasePath: string;
      }
    | {
          type: "frame";
          bitmap: ImageBitmap;
          timestamp: number;
      }
    | { type: "close" };

export type PoseWorkerResponse =
    | { type: "ready" }
    | { type: "result"; landmarks: PoseLandmarkMap | null }
    | { type: "error"; message: string };
