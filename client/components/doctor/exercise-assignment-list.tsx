"use client";

import { useState } from "react";
import { type AssignmentPlanUpdate, type ExerciseAssignment } from "@/lib/api";
import { formatAssignmentScoreSummary } from "@/lib/score";
import { AdherenceSummary } from "@/components/care/adherence-summary";

function formatDate(value?: string) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
}

const WEEKDAYS = [[1, "Mon"], [2, "Tue"], [3, "Wed"], [4, "Thu"], [5, "Fri"], [6, "Sat"], [7, "Sun"]] as const;

export function ExerciseAssignmentList({
  assignments,
  onRemove,
  onUpdatePlan,
  isBusy,
}: {
  assignments: ExerciseAssignment[];
  onRemove: (assignment: ExerciseAssignment) => void;
  onUpdatePlan: (assignmentId: string, data: AssignmentPlanUpdate) => Promise<boolean>;
  isBusy?: boolean;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  return (
    <div className="card" style={{ padding: "0", overflow: "hidden" }}>
      <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--color-border)" }}>
        <h2 style={{ fontSize: "18px", fontWeight: 600, margin: 0 }}>Assigned Exercises</h2>
      </div>
      {assignments.length === 0 ? (
        <div className="care-page-empty" role="status">
          <strong>No exercises assigned yet</strong>
          <p>Choose an available exercise to build this patient&apos;s plan.</p>
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
                {assignment.scheduledDays?.length ? <div style={{ color: "var(--color-text-muted)", fontSize: "12px", marginTop: "4px" }}>Scheduled: {WEEKDAYS.filter(([day]) => assignment.scheduledDays?.includes(day)).map(([, label]) => label).join(", ")}</div> : null}
                {(assignment.targetSets || assignment.targetRepsPerSet || assignment.targetDurationSeconds) && <div style={{ color: "var(--color-text-secondary)", fontSize: "12px", marginTop: "4px" }}>Prescription: {[assignment.targetSets ? `${assignment.targetSets} sets` : "", assignment.targetRepsPerSet ? `${assignment.targetRepsPerSet} reps/set` : "", assignment.targetDurationSeconds ? `${assignment.targetDurationSeconds}s` : ""].filter(Boolean).join(" · ")}</div>}
                {(assignment.minimumScore != null || assignment.minimumDurationSeconds) && <div style={{ color: "var(--color-text-secondary)", fontSize: "12px", marginTop: "4px" }}>Counts when: {[assignment.minimumScore != null ? `score ≥ ${assignment.minimumScore}` : "", assignment.minimumDurationSeconds ? `duration ≥ ${assignment.minimumDurationSeconds}s` : ""].filter(Boolean).join(" · ")}</div>}
                <AdherenceSummary adherence={assignment.adherence} showHistory />
                {assignment.doctorInstructions && <div style={{ marginTop: "6px", fontSize: "13px" }}><strong>Instructions:</strong> {assignment.doctorInstructions}</div>}
                {editingId === assignment.id && <form onSubmit={async (event) => {
                  event.preventDefault();
                  const form = new FormData(event.currentTarget);
                  const optionalNumber = (name: string) => String(form.get(name) || "") ? Number(form.get(name)) : null;
                  const saved = await onUpdatePlan(assignment.id, {
                    targetSessionsPerWeek: Number(form.get("targetSessionsPerWeek")),
                    targetSessionsPerDay: String(form.get("targetSessionsPerDay") || "") ? Number(form.get("targetSessionsPerDay")) : null,
                    scheduledDays: form.getAll("scheduledDays").map(Number),
                    targetSets: optionalNumber("targetSets"),
                    targetRepsPerSet: optionalNumber("targetRepsPerSet"),
                    targetDurationSeconds: optionalNumber("targetDurationSeconds"),
                    minimumScore: optionalNumber("minimumScore"),
                    minimumDurationSeconds: optionalNumber("minimumDurationSeconds"),
                    dueDate: String(form.get("dueDate") || "") || null,
                    reviewDate: String(form.get("reviewDate") || "") || null,
                    doctorInstructions: String(form.get("doctorInstructions") || "") || null,
                  });
                  if (saved) setEditingId(null);
                }} style={{ marginTop: "12px", display: "grid", gap: "8px" }}>
                  <label style={{ fontSize: "12px", fontWeight: 700 }}>Sessions per week<input className="input" name="targetSessionsPerWeek" type="number" min="1" max="14" defaultValue={assignment.targetSessionsPerWeek ?? 3} /></label>
                  <label style={{ fontSize: "12px", fontWeight: 700 }}>Sessions per day <span style={{ fontWeight: 400, color: "var(--color-text-muted)" }}>(optional; enables daily tracking)</span><input className="input" name="targetSessionsPerDay" type="number" min="1" max="5" defaultValue={assignment.targetSessionsPerDay ?? ""} placeholder="Use weekly target" /></label>
                  <fieldset style={{ border: 0, padding: 0, margin: 0 }}><legend style={{ fontSize: "12px", fontWeight: 700, marginBottom: "6px" }}>Scheduled days <span style={{ fontWeight: 400, color: "var(--color-text-muted)" }}>(none means any day)</span></legend><div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>{WEEKDAYS.map(([day, label]) => <label className="plan-day-choice" key={day}><input type="checkbox" name="scheduledDays" value={day} defaultChecked={assignment.scheduledDays?.includes(day)} />{label}</label>)}</div></fieldset>
                  <div className="doctor-form-grid">
                    <label style={{ fontSize: "12px", fontWeight: 700 }}>Sets<input className="input" name="targetSets" type="number" min="1" max="20" defaultValue={assignment.targetSets ?? ""} /></label>
                    <label style={{ fontSize: "12px", fontWeight: 700 }}>Reps per set<input className="input" name="targetRepsPerSet" type="number" min="1" max="100" defaultValue={assignment.targetRepsPerSet ?? ""} /></label>
                    <label style={{ fontSize: "12px", fontWeight: 700 }}>Target duration (seconds)<input className="input" name="targetDurationSeconds" type="number" min="1" max="300" defaultValue={assignment.targetDurationSeconds ?? ""} /></label>
                    <label style={{ fontSize: "12px", fontWeight: 700 }}>Minimum score to count<input className="input" name="minimumScore" type="number" min="0" max="100" step="0.01" defaultValue={assignment.minimumScore ?? ""} /></label>
                    <label style={{ fontSize: "12px", fontWeight: 700 }}>Minimum duration to count (seconds)<input className="input" name="minimumDurationSeconds" type="number" min="1" max="300" defaultValue={assignment.minimumDurationSeconds ?? ""} /></label>
                  </div>
                  <label style={{ fontSize: "12px", fontWeight: 700 }}>Due date<input className="input" name="dueDate" type="date" defaultValue={assignment.dueDate?.slice(0, 10) ?? ""} /></label>
                  <label style={{ fontSize: "12px", fontWeight: 700 }}>Review date<input className="input" name="reviewDate" type="date" defaultValue={assignment.reviewDate?.slice(0, 10) ?? ""} /></label>
                  <label style={{ fontSize: "12px", fontWeight: 700 }}>Instructions<textarea className="input" name="doctorInstructions" maxLength={2000} defaultValue={assignment.doctorInstructions ?? ""} style={{ minHeight: "70px", paddingTop: "8px" }} /></label>
                  <div><button className="btn btn-primary" type="submit" disabled={isBusy}>Save plan</button></div>
                </form>}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
                <span className="badge badge-blue">{formatAssignmentScoreSummary(assignment)}</span>
                <button className="btn btn-secondary" onClick={() => setEditingId(editingId === assignment.id ? null : assignment.id)} disabled={isBusy} aria-expanded={editingId === assignment.id} aria-label={`${editingId === assignment.id ? "Close" : "Edit"} plan for ${assignment.exercise?.name || "exercise"}`} style={{ padding: "0 14px" }}>Plan</button>
                <button className="btn btn-danger" onClick={() => onRemove(assignment)} disabled={isBusy} aria-label={`Remove ${assignment.exercise?.name || "exercise"}`} style={{ padding: "0 14px" }}>
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
