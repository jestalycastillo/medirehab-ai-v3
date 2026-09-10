"use client";

import { useState } from "react";
import { type ExerciseAssignment } from "@/lib/api";
import { formatScore } from "@/lib/score";
import { AdherenceSummary } from "@/components/care/adherence-summary";

function formatDate(value?: string) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
}

export function ExerciseAssignmentList({
  assignments,
  onRemove,
  onUpdatePlan,
  isBusy,
}: {
  assignments: ExerciseAssignment[];
  onRemove: (assignment: ExerciseAssignment) => void;
  onUpdatePlan: (assignmentId: string, data: { targetSessionsPerWeek: number; targetSessionsPerDay?: number | null; dueDate?: string | null; reviewDate?: string | null; doctorInstructions?: string | null }) => Promise<void> | void;
  isBusy?: boolean;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
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
                <div style={{ color: "var(--color-text-secondary)", fontSize: "13px", marginTop: "8px" }}>
                  Target {assignment.targetSessionsPerDay ? `${assignment.targetSessionsPerDay}/day` : `${assignment.targetSessionsPerWeek ?? 3}/week`}
                </div>
                <AdherenceSummary adherence={assignment.adherence} showHistory />
                {assignment.doctorInstructions && <div style={{ marginTop: "6px", fontSize: "13px" }}><strong>Instructions:</strong> {assignment.doctorInstructions}</div>}
                {editingId === assignment.id && <form onSubmit={async (event) => {
                  event.preventDefault();
                  const form = new FormData(event.currentTarget);
                  await onUpdatePlan(assignment.id, {
                    targetSessionsPerWeek: Number(form.get("targetSessionsPerWeek")),
                    targetSessionsPerDay: String(form.get("targetSessionsPerDay") || "") ? Number(form.get("targetSessionsPerDay")) : null,
                    dueDate: String(form.get("dueDate") || "") || null,
                    reviewDate: String(form.get("reviewDate") || "") || null,
                    doctorInstructions: String(form.get("doctorInstructions") || "") || null,
                  });
                  setEditingId(null);
                }} style={{ marginTop: "12px", display: "grid", gap: "8px" }}>
                  <label style={{ fontSize: "12px", fontWeight: 700 }}>Sessions per week<input className="input" name="targetSessionsPerWeek" type="number" min="1" max="14" defaultValue={assignment.targetSessionsPerWeek ?? 3} /></label>
                  <label style={{ fontSize: "12px", fontWeight: 700 }}>Sessions per day <span style={{ fontWeight: 400, color: "var(--color-text-muted)" }}>(optional; enables daily tracking)</span><input className="input" name="targetSessionsPerDay" type="number" min="1" max="5" defaultValue={assignment.targetSessionsPerDay ?? ""} placeholder="Use weekly target" /></label>
                  <label style={{ fontSize: "12px", fontWeight: 700 }}>Due date<input className="input" name="dueDate" type="date" defaultValue={assignment.dueDate?.slice(0, 10) ?? ""} /></label>
                  <label style={{ fontSize: "12px", fontWeight: 700 }}>Review date<input className="input" name="reviewDate" type="date" defaultValue={assignment.reviewDate?.slice(0, 10) ?? ""} /></label>
                  <label style={{ fontSize: "12px", fontWeight: 700 }}>Instructions<textarea className="input" name="doctorInstructions" maxLength={2000} defaultValue={assignment.doctorInstructions ?? ""} style={{ minHeight: "70px", paddingTop: "8px" }} /></label>
                  <div><button className="btn btn-primary" type="submit" disabled={isBusy}>Save plan</button></div>
                </form>}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
                <span className="badge badge-blue">Score {formatScore(assignment.result?.score)}</span>
                <button className="btn btn-secondary" onClick={() => setEditingId(editingId === assignment.id ? null : assignment.id)} disabled={isBusy} style={{ height: "38px", padding: "0 14px" }}>Plan</button>
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
