"use client";

import type { ExerciseKeyPointVisibility } from "@/lib/pose/exercise-key-points";
import { ExerciseKeyPointBody } from "./exercise-key-point-body";
import { UserCheck, CheckCircle2 } from "lucide-react";

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
                <div className="key-point-panel-title">
                    <UserCheck className="w-4 h-4 text-teal-600" />
                    <strong>Body visibility</strong>
                </div>
                <div className={`key-point-count ${allVisible ? "key-point-count-ready" : ""}`}>
                    {allVisible ? (
                        <span className="inline-flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            {visibleCount}/{requiredPoints.length}
                        </span>
                    ) : (
                        <span>
                            {visibleCount}/{requiredPoints.length}
                        </span>
                    )}
                </div>
            </div>

            <ExerciseKeyPointBody points={points} />

            <div className="key-point-progress" aria-hidden="true">
                <span
                    className={allVisible ? "key-point-progress-ready" : ""}
                    style={{ width: `${requiredPoints.length ? (visibleCount / requiredPoints.length) * 100 : 0}%` }}
                />
            </div>

            <div className="key-point-list">
                {requiredPoints.map((point) => (
                    <div
                        key={point.id}
                        className={point.isVisible ? "key-point-item key-point-item-visible" : "key-point-item"}
                    >
                        <span className="key-point-item-indicator" aria-hidden="true" />
                        <span className="key-point-item-text">{point.label}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}
