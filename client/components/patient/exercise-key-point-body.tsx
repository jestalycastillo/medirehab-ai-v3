import type { ExerciseKeyPointVisibility } from "@/lib/pose/exercise-key-points";

interface ExerciseKeyPointBodyProps {
    points: ExerciseKeyPointVisibility[];
}

const ACTIVE_POINT_COLOR = "#0F9F79";
const MISSING_POINT_COLOR = "#E05252";
const INACTIVE_POINT_COLOR = "#B9CDC8";

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
                    r={radius + 3}
                    fill={current.fill}
                    opacity="0.16"
                />
                <circle
                    cx={cx}
                    cy={cy}
                    r={radius}
                    fill={current.fill}
                    stroke="#FFFFFF"
                    strokeWidth="2"
                >
                    {current.label && <title>{current.label}</title>}
                </circle>
            </g>
        );
    };

    return (
        <svg
            viewBox="0 0 140 226"
            role="img"
            aria-label="Front body figure showing required visible points"
            className="key-point-body"
        >
            <defs>
                <linearGradient id="body-fill" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0" stopColor="#E4F3EF" />
                    <stop offset="1" stopColor="#C4DED8" />
                </linearGradient>
            </defs>

            <g
                fill="url(#body-fill)"
                stroke="#5D817A"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
            >
                <circle cx="70" cy="25" r="17" />
                <path d="M63 42 L62 49 Q52 51 47 58 Q45 78 49 103 Q52 116 58 125 L82 125 Q88 116 91 103 Q95 78 93 58 Q88 51 78 49 L77 42 Z" />
                <path d="M49 58 Q41 60 38 70 L29 100 Q27 106 31 109 Q35 112 38 106 L49 79" />
                <path d="M91 58 Q99 60 102 70 L111 100 Q113 106 109 109 Q105 112 102 106 L91 79" />
                <path d="M31 109 L27 139 Q27 148 33 149 Q39 149 40 141 L40 109" />
                <path d="M109 109 L113 139 Q113 148 107 149 Q101 149 100 141 L100 109" />
                <path d="M58 125 Q51 135 52 148 L56 180 L64 180 L70 145 L76 180 L84 180 L88 148 Q89 135 82 125 Z" />
                <path d="M56 180 L54 207 Q54 214 59 214 Q64 214 65 207 L64 180 Z" />
                <path d="M84 180 L86 207 Q86 214 81 214 Q76 214 75 207 L76 180 Z" />
                <path d="M54 207 Q45 211 44 217 L61 217 Q62 213 59 208" />
                <path d="M86 207 Q95 211 96 217 L79 217 Q78 213 81 208" />
            </g>

            <g fill="none" stroke="#7FA49C" strokeWidth="1.4" strokeLinecap="round" opacity="0.75">
                <path d="M70 49 L70 124" />
                <path d="M52 61 L88 61" />
                <path d="M52 61 L36 104 L33 141" />
                <path d="M88 61 L104 104 L107 141" />
                <path d="M59 125 L70 145 L81 125" />
                <path d="M59 127 L60 179 L59 208" />
                <path d="M81 127 L80 179 L81 208" />
            </g>

            {marker("nose", 70, 25, 4.5)}
            {marker("leftShoulder", 52, 61)}
            {marker("rightShoulder", 88, 61)}
            {marker("leftElbow", 36, 104)}
            {marker("rightElbow", 104, 104)}
            {marker("leftWrist", 33, 141)}
            {marker("rightWrist", 107, 141)}
            {marker("leftHip", 59, 126)}
            {marker("rightHip", 81, 126)}
            {marker("leftKnee", 60, 179)}
            {marker("rightKnee", 80, 179)}
            {marker("leftAnkle", 59, 208)}
            {marker("rightAnkle", 81, 208)}
        </svg>
    );
}
