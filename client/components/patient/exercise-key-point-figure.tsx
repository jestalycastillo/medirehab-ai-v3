"use client";

import type { ExerciseKeyPointVisibility } from "@/lib/pose/exercise-key-points";
import { ExerciseKeyPointBody } from "./exercise-key-point-body";

interface ExerciseKeyPointFigureProps {
    points: ExerciseKeyPointVisibility[];
}

export function ExerciseKeyPointFigure({ points }: ExerciseKeyPointFigureProps) {
    const requiredPoints = points.filter((point) => point.isRequired);
    const visibleCount = requiredPoints.filter((point) => point.isVisible).length;

    return (
        <div
            aria-label="Required body point visibility"
            style={{
                position: "absolute",
                top: "52px",
                right: "16px",
                width: "min(210px, calc(100% - 32px))",
                padding: "10px",
                borderRadius: "12px",
                backgroundColor: "rgba(15, 23, 42, 0.8)",
                color: "#FFF",
                zIndex: 10,
                boxShadow: "0 8px 24px rgba(0, 0, 0, 0.22)",
            }}
        >
            <div
                style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: "10px",
                    marginBottom: "8px",
                }}
            >
                <div
                    style={{
                        fontSize: "11px",
                        fontWeight: 700,
                        textTransform: "uppercase",
                        color: "rgba(255, 255, 255, 0.72)",
                    }}
                >
                    Key points
                </div>
                <div style={{ fontSize: "11px", color: "rgba(255, 255, 255, 0.72)" }}>
                    {visibleCount}/{requiredPoints.length}
                </div>
            </div>

            <ExerciseKeyPointBody points={points} />

            <div style={{ display: "grid", gap: "5px", marginTop: "8px" }}>
                {requiredPoints.map((point) => (
                    <div
                        key={point.id}
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "7px",
                            fontSize: "11px",
                            fontWeight: 600,
                            color: "rgba(255, 255, 255, 0.86)",
                        }}
                    >
                        <span
                            aria-hidden="true"
                            style={{
                                width: "8px",
                                height: "8px",
                                borderRadius: "9999px",
                                backgroundColor: point.isVisible ? "#22C55E" : "#EF4444",
                                flex: "0 0 auto",
                            }}
                        />
                        {point.label}
                    </div>
                ))}
            </div>
        </div>
    );
}
