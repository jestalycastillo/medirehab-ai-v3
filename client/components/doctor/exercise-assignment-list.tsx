"use client";

import { type ExerciseAssignment } from "@/lib/api";
import { formatScore } from "@/lib/score";

function formatDate(value?: string) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
}

export function ExerciseAssignmentList({
  assignments,
  onRemove,
  isBusy,
}: {
  assignments: ExerciseAssignment[];
  onRemove: (assignment: ExerciseAssignment) => void;
  isBusy?: boolean;
}) {
  return (
    <div className="card" style={{ padding: "0", overflow: "hidden" }}>
      <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--color-border)" }}>
        <h2 style={{ fontSize: "18px", fontWeight: 600, margin: 0 }}>Assigned Exercises</h2>
      </div>
      {assignments.length === 0 ? (
        <div style={{ padding: "32px 24px", textAlign: "center", color: "var(--color-text-muted)" }}>
          No exercises assigned yet.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column" }}>
          {assignments.map((assignment) => (
            <div key={assignment.id} style={{ padding: "18px 24px", borderBottom: "1px solid var(--color-page-bg)", display: "flex", justifyContent: "space-between", gap: "16px", alignItems: "center", flexWrap: "wrap" }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 600, color: "var(--color-text-primary)" }}>{assignment.exercise?.name || "Exercise"}</div>
                <div style={{ color: "var(--color-text-muted)", fontSize: "13px" }}>Assigned {formatDate(assignment.assignedAt)}</div>
                {assignment.exercise?.description && (
                  <div style={{ color: "var(--color-text-secondary)", fontSize: "14px", marginTop: "6px", maxWidth: "56ch" }}>{assignment.exercise.description}</div>
                )}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
                <span className="badge badge-blue">Score {formatScore(assignment.result?.score)}</span>
                <button className="btn btn-danger" onClick={() => onRemove(assignment)} disabled={isBusy} style={{ height: "38px", padding: "0 14px" }}>
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
