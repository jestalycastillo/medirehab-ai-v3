"use client";

import { type ApiExercise } from "@/lib/api";

export function ExercisePicker({
  exercises,
  onAssign,
  isBusy,
}: {
  exercises: ApiExercise[];
  onAssign: (exerciseId: string) => void;
  isBusy?: boolean;
}) {
  return (
    <div className="portal-panel">
      <div className="portal-panel-heading">
        <h2 style={{ fontSize: "18px", fontWeight: 600, margin: 0 }}>Available Exercises</h2>
      </div>
      {exercises.length === 0 ? (
        <div className="care-page-empty" role="status">
          <strong>No available exercises</strong>
          <p>No additional exercises can be assigned right now.</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column" }}>
          {exercises.map((exercise) => (
            <div key={exercise.id} className="portal-list-row">
              <div className="portal-list-copy">
                <div style={{ fontWeight: 600, color: "var(--color-text-primary)" }}>{exercise.name}</div>
                <div style={{ color: "var(--color-text-secondary)", fontSize: "14px", maxWidth: "56ch" }}>{exercise.description || "No description provided."}</div>
              </div>
              <button className="btn btn-primary" onClick={() => onAssign(exercise.id)} disabled={isBusy} aria-label={`Assign ${exercise.name}`} style={{ padding: "0 14px" }}>
                Assign
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
