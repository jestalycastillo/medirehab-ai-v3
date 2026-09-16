"use client";

import { CalendarDays, ChevronDown, Dumbbell } from "lucide-react";
import { getExerciseImageUrl, type ExerciseAssignment } from "@/lib/api";
import { CameraRecorder } from "./camera-recorder";

function formatDate(value?: string | null) {
  if (!value) return null;
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
}

const WEEKDAY_LABELS: Record<number, string> = { 1: "Mon", 2: "Tue", 3: "Wed", 4: "Thu", 5: "Fri", 6: "Sat", 7: "Sun" };

function ExerciseImage({ assignment }: { assignment: ExerciseAssignment }) {
  const image = assignment.exercise?.images?.[0];
  const imageSrc = getExerciseImageUrl(assignment.exercise);
  return (
    <div className="patient-exercise-card-image">
      {imageSrc ? (
        // Exercise images can come from the API or an administrator-provided URL.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageSrc}
          alt={image?.imageName || `${assignment.exercise.name} guide`}
          onError={(event) => { event.currentTarget.style.display = "none"; }}
        />
      ) : null}
      <div className="patient-exercise-card-placeholder" aria-hidden="true"><Dumbbell /><span>Exercise guide</span></div>
    </div>
  );
}

export function MyExerciseList({ assignments, compact = false }: { assignments: ExerciseAssignment[]; compact?: boolean }) {
  if (assignments.length === 0) {
    return (
      <div className="patient-exercise-empty">
        <span><Dumbbell /></span>
        <strong>No exercises found</strong>
        <p>Your assigned exercises will appear here.</p>
      </div>
    );
  }

  return (
    <div className={`patient-exercise-grid ${compact ? "patient-exercise-grid-compact" : ""}`}>
      {assignments.map((assignment) => {
        const primary = assignment.adherence?.today ?? assignment.adherence?.currentWeek;
        const progress = primary?.target ? Math.min(100, (primary.completed / primary.target) * 100) : 0;
        const prescription = [
          assignment.targetSets ? `${assignment.targetSets} sets` : "",
          assignment.targetRepsPerSet ? `${assignment.targetRepsPerSet} reps` : "",
          assignment.targetDurationSeconds ? `${assignment.targetDurationSeconds} sec` : "",
        ].filter(Boolean);

        return (
          <article className="patient-exercise-card" key={assignment.id}>
            <ExerciseImage assignment={assignment} />
            <div className="patient-exercise-card-body">
              <div>
                <h2>{assignment.exercise?.name || "Exercise"}</h2>
                <p>{assignment.exercise?.description || "Follow the movement your doctor assigned."}</p>
              </div>

              {prescription.length > 0 && <div className="patient-exercise-prescription">{prescription.map((item) => <span key={item}>{item}</span>)}</div>}

              {primary && (
                <div className="patient-exercise-goal">
                  <div><strong>{primary.completed} of {primary.target} done</strong><span>{primary.remaining > 0 ? `${primary.remaining} left ${assignment.adherence?.today ? "today" : "this week"}` : "Goal complete"}</span></div>
                  <div className="patient-exercise-progress"><span style={{ width: `${progress}%` }} /></div>
                </div>
              )}

              {assignment.doctorInstructions && <div className="patient-exercise-doctor-note"><strong>Your doctor says:</strong> {assignment.doctorInstructions}</div>}

              <div className="patient-exercise-card-action">
                <CameraRecorder
                  exerciseName={assignment.exercise?.name}
                  analysisModelKey={assignment.exercise?.analysisModelKey}
                  exerciseId={assignment.exercise?.id}
                  assignmentId={assignment.id}
                  targetDurationSeconds={assignment.targetDurationSeconds}
                  minimumDurationSeconds={assignment.minimumDurationSeconds}
                />
              </div>

              <details className="patient-exercise-details">
                <summary>Plan details <ChevronDown /></summary>
                <div>
                  <p><CalendarDays /> <span>{assignment.scheduledDays?.length ? assignment.scheduledDays.map((day) => WEEKDAY_LABELS[day]).join(", ") : assignment.targetSessionsPerDay ? `${assignment.targetSessionsPerDay} session${assignment.targetSessionsPerDay === 1 ? "" : "s"} each day` : `${assignment.targetSessionsPerWeek ?? 3} sessions each week`}</span></p>
                  {assignment.dueDate && <p><strong>Due:</strong> {formatDate(assignment.dueDate)}</p>}
                  {assignment.minimumScore != null && <p><strong>Minimum score:</strong> {assignment.minimumScore}</p>}
                  {assignment.minimumDurationSeconds && <p><strong>Minimum recording:</strong> {assignment.minimumDurationSeconds} seconds</p>}
                </div>
              </details>
            </div>
          </article>
        );
      })}
    </div>
  );
}
