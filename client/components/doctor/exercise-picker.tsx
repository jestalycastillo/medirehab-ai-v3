"use client";

import { type ApiExercise } from "@/lib/api";
import { DoctorExerciseImage } from "./doctor-exercise-image";

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
        <h2>Individual exercises</h2>
        <p>Choose a movement to add to the care plan.</p>
      </div>
      {exercises.length === 0 ? (
        <div className="care-page-empty" role="status">
          <strong>No available exercises</strong>
          <p>No additional exercises can be assigned right now.</p>
        </div>
      ) : (
        <div className="doctor-exercise-picker-grid">
          {exercises.map((exercise) => (
            <article key={exercise.id} className="doctor-exercise-picker-card">
              <DoctorExerciseImage exercise={exercise} name={exercise.name} />
              <div className="doctor-exercise-picker-card-body">
                <h3>{exercise.name}</h3>
                <p className="doctor-exercise-picker-description">{exercise.description || "No description provided."}</p>
                <button type="button" className="btn btn-primary" onClick={() => onAssign(exercise.id)} disabled={isBusy} aria-label={`Assign ${exercise.name}`}>
                  Assign exercise
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
