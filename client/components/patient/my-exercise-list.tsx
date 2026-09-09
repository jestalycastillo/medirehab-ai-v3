"use client";

import { type ExerciseAssignment } from "@/lib/api";
import { CameraRecorder } from "./camera-recorder";
import { formatScore } from "@/lib/score";

function formatDate(value?: string) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

export function MyExerciseList({
  assignments,
  compact = false,
}: {
  assignments: ExerciseAssignment[];
  compact?: boolean;
}) {
  if (assignments.length === 0) {
    return (
      <div style={{ padding: compact ? "28px 20px" : "40px 24px", textAlign: "center", color: "var(--color-text-muted)" }}>
        No exercises assigned yet.
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: compact ? "1fr" : "repeat(auto-fit, minmax(280px, 1fr))", gap: "16px" }}>
      {assignments.map((assignment) => (
        <article
          key={assignment.id}
          style={{
            border: "1px solid var(--color-border)",
            borderRadius: "var(--radius-md)",
            backgroundColor: "var(--color-surface)",
            padding: "18px",
            display: "flex",
            flexDirection: "column",
            gap: "14px",
            minWidth: 0,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "flex-start" }}>
            <div style={{ minWidth: 0 }}>
              <h3 style={{ fontSize: "16px", fontWeight: 700, margin: "0 0 4px 0", color: "var(--color-text-primary)" }}>
                {assignment.exercise?.name || "Exercise"}
              </h3>
              <p style={{ fontSize: "13px", color: "var(--color-text-muted)", margin: 0 }}>
                Assigned {formatDate(assignment.assignedAt)}
              </p>
            </div>
            <span className="badge badge-blue">Score {formatScore(assignment.result?.score)}</span>
          </div>

          <p style={{ fontSize: "14px", color: "var(--color-text-secondary)", margin: 0 }}>
            {assignment.exercise?.description || "Follow the rehabilitation plan provided by your doctor."}
          </p>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            <span className="badge badge-blue">Target {assignment.targetSessionsPerWeek ?? 3}/week</span>
            {assignment.dueDate && <span className="badge badge-blue">Due {formatDate(assignment.dueDate)}</span>}
          </div>
          {assignment.doctorInstructions && <div style={{ padding: "10px 12px", backgroundColor: "var(--color-primary-light)", borderRadius: "var(--radius-md)", fontSize: "13px" }}><strong>Doctor instructions:</strong> {assignment.doctorInstructions}</div>}

          {assignment.exercise?.images?.length ? (
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              {assignment.exercise.images.slice(0, 3).map((image) => (
                <span key={`${assignment.id}-${image.filepath}`} className="badge badge-blue">
                  {image.imageName || "Reference"}
                </span>
              ))}
            </div>
          ) : null}

          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginTop: "auto" }}>
            <CameraRecorder
              exerciseName={assignment.exercise?.name}
              exerciseId={assignment.exercise?.id}
              assignmentId={assignment.id}
            />
          </div>
        </article>
      ))}
    </div>
  );
}
