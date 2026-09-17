import type { ExerciseKeyPointVisibility } from "@/lib/pose/exercise-key-points";

interface ExerciseKeyPointBodyProps {
    points: ExerciseKeyPointVisibility[];
}

const ACTIVE_POINT_COLOR = "#10b981";
const MISSING_POINT_COLOR = "#ef4444";
const INACTIVE_POINT_COLOR = "#cbd5e1";

function getPointColor(
    points: ExerciseKeyPointVisibility[],
    id: ExerciseKeyPointVisibility["id"],
): string {
    const point = points.find((candidate) => candidate.id === id);
    if (!point?.isRequired) return INACTIVE_POINT_COLOR;
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
    const marker = (
        id: ExerciseKeyPointVisibility["id"],
        cx: number,
        cy: number,
        radius = 5.5,
    ) => {
        const current = point(id);

        return (
            <g>
                <circle
                    cx={cx}
                    cy={cy}
                    r={radius}
                    fill={current.fill}
                    stroke="#FFFFFF"
                    strokeWidth="2.5"
                >
                    {current.label && <title>{current.label}</title>}
                </circle>
            </g>
        );
    };

    return (
        <svg
            viewBox="0 0 200 240"
            role="img"
            aria-label="Demo-style body figure showing required visible points"
            className="key-point-body"
        >
            {/* Match the neutral figure in the movement demo; markers carry live status. */}
            <g stroke="#111827" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none">
                <path d="M80 148 L120 148" strokeWidth="3.5" />
                <path d="M82 148 L82 190 L80 230" />
                <path d="M118 148 L118 190 L120 230" />
                <path d="M72 76 L50 108 L34 141" />
                <path d="M128 76 L150 108 L166 141" />
            </g>
            <path
                d="M72 76 L128 76 L120 148 L80 148 Z"
                fill="#F8FAFC"
                stroke="#111827"
                strokeWidth="2"
                strokeLinejoin="round"
            />
            <line x1="100" y1="56" x2="100" y2="148" stroke="#111827" strokeWidth="2" strokeDasharray="3 3" />
            <g stroke="#111827" strokeLinecap="round">
                <line x1="100" y1="56" x2="100" y2="68" strokeWidth="3" />
                <circle cx="100" cy="36" r="18" fill="#FFFFFF" strokeWidth="3" />
                <path d="M92 35 Q100 33 108 35" fill="none" strokeWidth="2.5" />
                <circle cx="100" cy="38" r="2" fill="#111827" stroke="none" />
            </g>
            <polygon points="100,74 108,84 100,94 92,84" fill="#E2E8F0" stroke="#111827" strokeWidth="2" />

            {marker("nose", 100, 36, 5)}
            {marker("chest", 100, 84, 5)}
            {marker("leftShoulder", 72, 76)}
            {marker("rightShoulder", 128, 76)}
            {marker("leftElbow", 50, 108)}
            {marker("rightElbow", 150, 108)}
            {marker("leftWrist", 34, 141)}
            {marker("rightWrist", 166, 141)}
            {marker("leftHip", 82, 148)}
            {marker("rightHip", 118, 148)}
            {marker("leftKnee", 82, 190)}
            {marker("rightKnee", 118, 190)}
            {marker("leftAnkle", 80, 230)}
            {marker("rightAnkle", 120, 230)}
        </svg>
    );
}
