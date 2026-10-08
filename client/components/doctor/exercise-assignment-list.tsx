"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { PortalActionMenu } from "@/components/ui/portal-action-menu";
import { type AssignmentPlanUpdate, type ExerciseAssignment } from "@/lib/api";
import { formatAssignmentScoreSummary } from "@/lib/score";
import { AdherenceSummary } from "@/components/care/adherence-summary";

function formatDate(value?: string) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
}

const WEEKDAYS = [[1, "Mon"], [2, "Tue"], [3, "Wed"], [4, "Thu"], [5, "Fri"], [6, "Sat"], [7, "Sun"]] as const;

function CarePlanDrawer({
  assignment,
  onClose,
  onUpdatePlan,
  isBusy,
}: {
  assignment: ExerciseAssignment | null;
  onClose: () => void;
  onUpdatePlan: (assignmentId: string, data: AssignmentPlanUpdate) => Promise<boolean>;
  isBusy?: boolean;
}) {
  if (!assignment) return null;

  return (
    <>
      <button type="button" className="doctor-care-drawer-backdrop" onClick={onClose} aria-label="Close care plan editor" />
      <aside className="doctor-care-drawer" id="care-plan-drawer" role="dialog" aria-labelledby="care-plan-drawer-title">
        <header className="doctor-care-drawer-heading">
          <div>
            <span>Care plan</span>
            <h2 id="care-plan-drawer-title">{assignment.exercise?.name || "Exercise"}</h2>
          </div>
          <button type="button" className="doctor-care-drawer-close" onClick={onClose} aria-label="Close care plan editor">
            <X aria-hidden="true" />
          </button>
        </header>
        <form onSubmit={async (event) => {
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
          if (saved) onClose();
        }} className="doctor-care-drawer-form">
          <p className="doctor-care-drawer-description">Set targets, schedule, and instructions without changing the assigned-exercise list.</p>
          <label>Sessions per week<input className="input" name="targetSessionsPerWeek" type="number" min="1" max="14" defaultValue={assignment.targetSessionsPerWeek ?? 3} /></label>
          <label>Sessions per day <span>(optional; enables daily tracking)</span><input className="input" name="targetSessionsPerDay" type="number" min="1" max="5" defaultValue={assignment.targetSessionsPerDay ?? ""} placeholder="Use weekly target" /></label>
          <fieldset><legend>Scheduled days <span>(none means any day)</span></legend><div className="doctor-care-day-choices">{WEEKDAYS.map(([day, label]) => <label className="plan-day-choice" key={day}><input type="checkbox" name="scheduledDays" value={day} defaultChecked={assignment.scheduledDays?.includes(day)} />{label}</label>)}</div></fieldset>
          <div className="doctor-form-grid">
            <label>Sets<input className="input" name="targetSets" type="number" min="1" max="20" defaultValue={assignment.targetSets ?? ""} /></label>
            <label>Reps per set<input className="input" name="targetRepsPerSet" type="number" min="1" max="100" defaultValue={assignment.targetRepsPerSet ?? ""} /></label>
            <label>Target duration (seconds)<input className="input" name="targetDurationSeconds" type="number" min="1" max="300" defaultValue={assignment.targetDurationSeconds ?? ""} /></label>
            <label>Minimum score to count<input className="input" name="minimumScore" type="number" min="0" max="100" step="0.01" defaultValue={assignment.minimumScore ?? ""} /></label>
            <label>Minimum duration to count (seconds)<input className="input" name="minimumDurationSeconds" type="number" min="1" max="300" defaultValue={assignment.minimumDurationSeconds ?? ""} /></label>
          </div>
          <label>Due date<input className="input" name="dueDate" type="date" defaultValue={assignment.dueDate?.slice(0, 10) ?? ""} /></label>
          <label>Review date<input className="input" name="reviewDate" type="date" defaultValue={assignment.reviewDate?.slice(0, 10) ?? ""} /></label>
          <label>Instructions<textarea className="input" name="doctorInstructions" maxLength={2000} defaultValue={assignment.doctorInstructions ?? ""} /></label>
          <div className="portal-list-actions"><button className="btn btn-primary" type="submit" disabled={isBusy}>Save plan</button><button className="btn btn-secondary" type="button" onClick={onClose} disabled={isBusy}>Cancel</button></div>
        </form>
      </aside>
    </>
  );
}

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
  const editingAssignment = assignments.find((assignment) => assignment.id === editingId) ?? null;

  return (
    <>
      <div className="portal-panel portal-assignment-panel">
        <div className="portal-panel-heading">
          <h2 style={{ fontSize: "18px", fontWeight: 600, margin: 0 }}>Prescribed exercises</h2>
        </div>
        {assignments.length === 0 ? (
          <div className="care-page-empty" role="status">
            <strong>No exercises assigned yet</strong>
            <p>Choose an available exercise to build this patient&apos;s plan.</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column" }}>
            {assignments.map((assignment) => (
              <div key={assignment.id} className="portal-list-row portal-assignment-row">
                <div className="portal-list-copy">
                  <div style={{ fontWeight: 600, color: "var(--color-text-primary)" }}>{assignment.exercise?.name || "Exercise"}</div>
                  <div style={{ color: "var(--color-text-muted)", fontSize: "13px" }}>Assigned {formatDate(assignment.assignedAt)}</div>
                  {assignment.exercise?.description && <div style={{ color: "var(--color-text-secondary)", fontSize: "14px", marginTop: "6px", maxWidth: "56ch" }}>{assignment.exercise.description}</div>}
                  <div style={{ color: "var(--color-text-secondary)", fontSize: "13px", marginTop: "8px" }}>Target {assignment.targetSessionsPerDay ? `${assignment.targetSessionsPerDay}/day` : `${assignment.targetSessionsPerWeek ?? 3}/week`}</div>
                  {assignment.scheduledDays?.length ? <div style={{ color: "var(--color-text-muted)", fontSize: "12px", marginTop: "4px" }}>Scheduled: {WEEKDAYS.filter(([day]) => assignment.scheduledDays?.includes(day)).map(([, label]) => label).join(", ")}</div> : null}
                  {(assignment.targetSets || assignment.targetRepsPerSet || assignment.targetDurationSeconds) && <div style={{ color: "var(--color-text-secondary)", fontSize: "12px", marginTop: "4px" }}>Prescription: {[assignment.targetSets ? `${assignment.targetSets} sets` : "", assignment.targetRepsPerSet ? `${assignment.targetRepsPerSet} reps/set` : "", assignment.targetDurationSeconds ? `${assignment.targetDurationSeconds}s` : ""].filter(Boolean).join(" · ")}</div>}
                  {(assignment.minimumScore != null || assignment.minimumDurationSeconds) && <div style={{ color: "var(--color-text-secondary)", fontSize: "12px", marginTop: "4px" }}>Counts when: {[assignment.minimumScore != null ? `score ≥ ${assignment.minimumScore}` : "", assignment.minimumDurationSeconds ? `duration ≥ ${assignment.minimumDurationSeconds}s` : ""].filter(Boolean).join(" · ")}</div>}
                  <AdherenceSummary adherence={assignment.adherence} showHistory />
                  {assignment.doctorInstructions && <div style={{ marginTop: "6px", fontSize: "13px" }}><strong>Instructions:</strong> {assignment.doctorInstructions}</div>}
                </div>
                <div className="portal-list-actions">
                  <span className="badge badge-blue">{formatAssignmentScoreSummary(assignment)}</span>
                  <button className="btn btn-secondary" onClick={() => setEditingId(assignment.id)} disabled={isBusy} aria-expanded={editingId === assignment.id} aria-controls="care-plan-drawer" style={{ padding: "0 14px" }}>Plan</button>
                  <PortalActionMenu label={`More actions for ${assignment.exercise?.name || "exercise"}`}>
                    <button className="list-row-action-danger" onClick={() => onRemove(assignment)} disabled={isBusy}>Remove from care plan</button>
                  </PortalActionMenu>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <CarePlanDrawer assignment={editingAssignment} onClose={() => setEditingId(null)} onUpdatePlan={onUpdatePlan} isBusy={isBusy} />
    </>
  );
}
