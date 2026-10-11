"use client";

import { type ExercisePreset } from "@/lib/api";
import { DoctorExerciseImage } from "./doctor-exercise-image";

export function ExercisePresetPicker({ presets, onAssign, isBusy }: {
  presets: ExercisePreset[];
  onAssign: (presetId: string) => void;
  isBusy: boolean;
}) {
  return (
    <div className="portal-panel">
      <div className="portal-panel-heading">
        <h2>Exercise presets</h2>
        <p>Review a group of movements and add them together.</p>
      </div>
      <div className="doctor-exercise-picker-grid">
      {presets.map((preset) => {
        const assignedIds = new Set(preset.assignedExerciseIds);
        const remaining = preset.exercises.filter((exercise) => !assignedIds.has(exercise.id)).length;
        const unavailable = preset.missingExerciseNames.length > 0;
        return (
          <article key={preset.id} className="doctor-exercise-picker-card doctor-preset-card">
            <div className="doctor-preset-preview">
              {preset.exerciseNames.map((name) => (
                <DoctorExerciseImage key={name} exercise={preset.exercises.find((item) => item.name === name)} name={name} />
              ))}
            </div>
            <div className="doctor-exercise-picker-card-body">
              <div className="doctor-preset-card-meta"><span>{preset.exerciseNames.length} exercises</span><span className="badge badge-blue">Demo</span></div>
              <h3>{preset.name}</h3>
              <p className="doctor-exercise-picker-description">{preset.description}</p>
              <details className="doctor-preset-contents">
                <summary>Included exercises</summary>
                <ul>
                {preset.exerciseNames.map((name) => {
                  const exercise = preset.exercises.find((item) => item.name === name);
                  return <li key={name}>{name}{!exercise ? " — unavailable" : assignedIds.has(exercise.id) ? " — already assigned" : ""}</li>;
                })}
                </ul>
              </details>
              <p className="doctor-preset-status">
                {unavailable ? "This preset requires all listed exercises to be active in the catalog." : remaining === 0 ? "All exercises in this preset are already assigned." : `${remaining} exercise${remaining === 1 ? "" : "s"} will be added. Already assigned exercises keep their current plans.`}
              </p>
            <button type="button" className="btn btn-primary" disabled={isBusy || unavailable || remaining === 0} onClick={() => onAssign(preset.id)} aria-label={`Assign ${preset.name} preset`}>
              {remaining === 0 && !unavailable ? "Already assigned" : "Assign preset"}
            </button>
            </div>
          </article>
        );
      })}
      </div>
    </div>
  );
}
