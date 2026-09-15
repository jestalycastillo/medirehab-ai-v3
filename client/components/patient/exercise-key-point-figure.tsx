"use client";

import type { ExerciseKeyPointVisibility } from "@/lib/pose/exercise-key-points";
import { ExerciseKeyPointBody } from "./exercise-key-point-body";

interface ExerciseKeyPointFigureProps {
    points: ExerciseKeyPointVisibility[];
}

export function ExerciseKeyPointFigure({ points }: ExerciseKeyPointFigureProps) {
    const requiredPoints = points.filter((point) => point.isRequired);
    const visibleCount = requiredPoints.filter((point) => point.isVisible).length;
    const allVisible = requiredPoints.length > 0 && visibleCount === requiredPoints.length;

    return (
        <div
            aria-label="Required body point visibility"
            className="key-point-panel"
        >
            <div className="key-point-panel-header">
                <div>
                    <strong>Body visibility</strong>
                </div>
                <div className={`key-point-count ${allVisible ? "key-point-count-ready" : ""}`}>
                    {visibleCount}/{requiredPoints.length}
                </div>
            </div>

            <ExerciseKeyPointBody points={points} />

            <div className="key-point-progress" aria-hidden="true">
                <span style={{ width: `${requiredPoints.length ? (visibleCount / requiredPoints.length) * 100 : 0}%` }} />
            </div>

            <div className="key-point-list">
                {requiredPoints.map((point) => (
                    <div
                        key={point.id}
                        className={point.isVisible ? "key-point-item key-point-item-visible" : "key-point-item"}
                    >
                        <span aria-hidden="true" />
                        {point.label}
                    </div>
                ))}
            </div>
        </div>
    );
}
