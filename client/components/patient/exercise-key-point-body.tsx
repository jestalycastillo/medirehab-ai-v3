import type { ExerciseKeyPointVisibility } from "@/lib/pose/exercise-key-points";

interface ExerciseKeyPointBodyProps {
    points: ExerciseKeyPointVisibility[];
}

const ACTIVE_POINT_COLOR = "#22C55E";
const MISSING_POINT_COLOR = "#EF4444";
const BODY_FILL = "rgba(226, 232, 240, 0.14)";
const BODY_STROKE = "rgba(255, 255, 255, 0.52)";

function getPointColor(
    points: ExerciseKeyPointVisibility[],
    id: ExerciseKeyPointVisibility["id"],
): string {
    const point = points.find((candidate) => candidate.id === id);
    if (!point?.isRequired) return BODY_FILL;
    return point.isVisible ? ACTIVE_POINT_COLOR : MISSING_POINT_COLOR;
}

function getPointLabel(
    points: ExerciseKeyPointVisibility[],
    id: ExerciseKeyPointVisibility["id"],
): string | undefined {
    const point = points.find((candidate) => candidate.id === id);
    if (!point?.isRequired) return undefined;
    return `${point.label}: ${point.isVisible ? "visible" : "not visible"}`;
}

export function ExerciseKeyPointBody({ points }: ExerciseKeyPointBodyProps) {
    const point = (id: ExerciseKeyPointVisibility["id"]) => ({
        fill: getPointColor(points, id),
        label: getPointLabel(points, id),
    });
    const leftShoulder = point("leftShoulder");
    const rightShoulder = point("rightShoulder");
    const leftElbow = point("leftElbow");
    const rightElbow = point("rightElbow");
    const nose = point("nose");
    const leftWrist = point("leftWrist");
    const rightWrist = point("rightWrist");
    const leftHip = point("leftHip");
    const rightHip = point("rightHip");
    const leftKnee = point("leftKnee");
    const rightKnee = point("rightKnee");
    const leftAnkle = point("leftAnkle");
    const rightAnkle = point("rightAnkle");

    return (
        <svg
            viewBox="0 0 140 220"
            role="img"
            aria-label="Front body figure showing required visible points"
            style={{ width: "100%", height: "190px", display: "block" }}
        >
            <g stroke={BODY_STROKE} strokeWidth="1.6" strokeLinejoin="round">
                <ellipse cx="70" cy="25" rx="16" ry="19" fill={BODY_FILL} />
                <path d="M59 43 L53 54 L43 59 L47 106 L59 119 L81 119 L93 106 L97 59 L87 54 L81 43 Z" fill={BODY_FILL} />
                <path d="M53 54 C47 52 41 55 37 62 L29 91 L35 96 L45 79 L50 65 Z" fill={BODY_FILL} />
                <path d="M87 54 C93 52 99 55 103 62 L111 91 L105 96 L95 79 L90 65 Z" fill={BODY_FILL} />
                <path d="M35 96 L29 125 L35 151 L43 151 L45 119 L45 79 Z" fill={BODY_FILL} />
                <path d="M105 96 L111 125 L105 151 L97 151 L95 119 L95 79 Z" fill={BODY_FILL} />
                <path d="M59 119 L48 130 L51 180 L61 180 L70 142 L79 180 L89 180 L92 130 L81 119 Z" fill={BODY_FILL} />
                <path d="M51 180 L49 207 L59 207 L65 180 Z" fill={BODY_FILL} />
                <path d="M89 180 L91 207 L81 207 L75 180 Z" fill={BODY_FILL} />
                <path d="M49 207 L42 212 L60 212 L59 207 Z" fill={BODY_FILL} />
                <path d="M91 207 L98 212 L80 212 L81 207 Z" fill={BODY_FILL} />
            </g>

            <g stroke="#FFFFFF" strokeWidth="1.5" strokeLinejoin="round">
                <ellipse cx="70" cy="25" rx="16" ry="19" fill={nose.fill}>
                    {nose.label && <title>{nose.label}</title>}
                </ellipse>
                <path d="M53 54 C47 52 41 55 37 62 L42 72 L51 68 L57 59 Z" fill={leftShoulder.fill}>
                    {leftShoulder.label && <title>{leftShoulder.label}</title>}
                </path>
                <path d="M87 54 C93 52 99 55 103 62 L98 72 L89 68 L83 59 Z" fill={rightShoulder.fill}>
                    {rightShoulder.label && <title>{rightShoulder.label}</title>}
                </path>
                <path d="M29 91 L35 96 L40 108 L34 116 L28 108 Z" fill={leftElbow.fill}>
                    {leftElbow.label && <title>{leftElbow.label}</title>}
                </path>
                <path d="M111 91 L105 96 L100 108 L106 116 L112 108 Z" fill={rightElbow.fill}>
                    {rightElbow.label && <title>{rightElbow.label}</title>}
                </path>
                <ellipse cx="34" cy="125" rx="6" ry="8" fill={leftWrist.fill}>
                    {leftWrist.label && <title>{leftWrist.label}</title>}
                </ellipse>
                <ellipse cx="106" cy="125" rx="6" ry="8" fill={rightWrist.fill}>
                    {rightWrist.label && <title>{rightWrist.label}</title>}
                </ellipse>
                <path d="M59 119 L48 130 L57 143 L70 142 L70 119 Z" fill={leftHip.fill}>
                    {leftHip.label && <title>{leftHip.label}</title>}
                </path>
                <path d="M81 119 L92 130 L83 143 L70 142 L70 119 Z" fill={rightHip.fill}>
                    {rightHip.label && <title>{rightHip.label}</title>}
                </path>
                <ellipse cx="56" cy="180" rx="8" ry="7" fill={leftKnee.fill}>
                    {leftKnee.label && <title>{leftKnee.label}</title>}
                </ellipse>
                <ellipse cx="84" cy="180" rx="8" ry="7" fill={rightKnee.fill}>
                    {rightKnee.label && <title>{rightKnee.label}</title>}
                </ellipse>
                <ellipse cx="54" cy="207" rx="7" ry="5" fill={leftAnkle.fill}>
                    {leftAnkle.label && <title>{leftAnkle.label}</title>}
                </ellipse>
                <ellipse cx="86" cy="207" rx="7" ry="5" fill={rightAnkle.fill}>
                    {rightAnkle.label && <title>{rightAnkle.label}</title>}
                </ellipse>
            </g>
        </svg>
    );
}
