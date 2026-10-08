"use client";

import { CalendarDays, ChevronRight, Dumbbell, X } from "lucide-react";
import { useState } from "react";
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
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  return (
    <div className="patient-exercise-card-image">
      {imageSrc && failedSrc !== imageSrc ? (
        // Exercise images can come from the API or an administrator-provided URL.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageSrc}
          alt={image?.imageName || `${assignment.exercise.name} guide`}
          onError={() => setFailedSrc(imageSrc)}
        />
      ) : <div className="patient-exercise-card-placeholder" aria-hidden="true"><Dumbbell /><span>Exercise guide</span></div>}
    </div>
  );
}

function ExerciseDetailPanel({
  assignment,
  onClose,
}: {
  assignment: ExerciseAssignment | null;
  onClose: () => void;
}) {
  if (!assignment) {
    return (
      <aside className="patient-exercise-detail-panel patient-exercise-detail-empty" aria-label="Exercise details">
        <Dumbbell aria-hidden="true" />
        <strong>Select an exercise</strong>
        <p>Its schedule, guidance, and safety information will appear here.</p>
      </aside>
    );
  }

  const prescription = [
    assignment.targetSets ? `${assignment.targetSets} sets` : "",
    assignment.targetRepsPerSet ? `${assignment.targetRepsPerSet} reps` : "",
    assignment.targetDurationSeconds ? `${assignment.targetDurationSeconds} sec` : "",
  ].filter(Boolean);
  const schedule = assignment.scheduledDays?.length
    ? assignment.scheduledDays.map((day) => WEEKDAY_LABELS[day]).join(", ")
    : assignment.targetSessionsPerDay
      ? `${assignment.targetSessionsPerDay} session${assignment.targetSessionsPerDay === 1 ? "" : "s"} each day`
      : `${assignment.targetSessionsPerWeek ?? 3} sessions each week`;

  return (
    <aside className="patient-exercise-detail-panel" id="exercise-details-panel" aria-live="polite" aria-labelledby="exercise-details-title">
      <header className="patient-exercise-detail-heading">
        <div>
          <span>Exercise details</span>
          <h2 id="exercise-details-title">{assignment.exercise?.name || "Exercise"}</h2>
        </div>
        <button type="button" className="patient-exercise-detail-close" onClick={onClose} aria-label="Close exercise details">
          <X aria-hidden="true" />
        </button>
      </header>
      <ExerciseImage assignment={assignment} />
      <div className="patient-exercise-detail-content">
        <p className="patient-exercise-detail-description">{assignment.exercise?.description || "Follow the movement your doctor assigned."}</p>
        {prescription.length > 0 && <div className="patient-exercise-prescription">{prescription.map((item) => <span key={item}>{item}</span>)}</div>}
        {assignment.doctorInstructions && <div className="patient-exercise-doctor-note"><strong>Your doctor says:</strong> {assignment.doctorInstructions}</div>}

        <section className="patient-exercise-detail-section">
          <h3>Plan</h3>
          <p><CalendarDays aria-hidden="true" /><span>{schedule}</span></p>
          {assignment.dueDate && <p><strong>Due:</strong> {formatDate(assignment.dueDate)}</p>}
          {assignment.minimumScore != null && <p><strong>Minimum score:</strong> {assignment.minimumScore}</p>}
          {assignment.minimumDurationSeconds && <p><strong>Minimum recording:</strong> {assignment.minimumDurationSeconds} seconds</p>}
        </section>

        <section className="patient-exercise-detail-section">
          <h3>Guidance</h3>
          <div className="patient-guidance-actions">
            <CameraRecorder exerciseName={assignment.exercise?.name} analysisModelKey={assignment.exercise?.analysisModelKey} exerciseId={assignment.exercise?.id} guidelineSlides={assignment.exercise?.guidelineSlides} guidelinesOnly launchLabel="Safety guidelines" />
            <CameraRecorder exerciseName={assignment.exercise?.name} analysisModelKey={assignment.exercise?.analysisModelKey} exerciseId={assignment.exercise?.id} demoOnly launchLabel="Movement demo" />
          </div>
        </section>
      </div>
    </aside>
  );
}

export function MyExerciseList({ assignments, compact = false, emptyMessage = "No exercises found", emptyDescription = "Your assigned exercises will appear here." }: { assignments: ExerciseAssignment[]; compact?: boolean; emptyMessage?: string; emptyDescription?: string }) {
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string | null>(null);
  const selectedAssignment = assignments.find((assignment) => assignment.id === selectedAssignmentId) ?? null;

  if (assignments.length === 0) {
    return (
      <div className="patient-exercise-empty" role="status">
        <span><Dumbbell /></span>
        <strong>{emptyMessage}</strong>
        <p>{emptyDescription}</p>
      </div>
    );
  }

  return (
    <div className="patient-exercise-layout">
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
          <article className={`patient-exercise-card ${selectedAssignmentId === assignment.id ? "patient-exercise-card-selected" : ""}`} key={assignment.id}>
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
                  <div className="patient-exercise-progress" role="progressbar" aria-label={`${assignment.exercise?.name || "Exercise"} sessions complete`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress)} aria-valuetext={`${primary.completed} of ${primary.target} sessions complete`}><span style={{ width: `${progress}%` }} /></div>
                </div>
              )}

              <div className="patient-exercise-card-action">
                <CameraRecorder
                  exerciseName={assignment.exercise?.name}
                  analysisModelKey={assignment.exercise?.analysisModelKey}
                  exerciseId={assignment.exercise?.id}
                  assignmentId={assignment.id}
                  targetDurationSeconds={assignment.targetDurationSeconds}
                  minimumDurationSeconds={assignment.minimumDurationSeconds}
                  guidelineSlides={assignment.exercise?.guidelineSlides}
                />
              </div>

              <button
                type="button"
                className="patient-exercise-details-trigger"
                onClick={() => setSelectedAssignmentId(assignment.id)}
                aria-pressed={selectedAssignmentId === assignment.id}
                aria-controls="exercise-details-panel"
              >
                View details <ChevronRight aria-hidden="true" />
              </button>
            </div>
          </article>
        );
      })}
      </div>
      <ExerciseDetailPanel assignment={selectedAssignment} onClose={() => setSelectedAssignmentId(null)} />
    </div>
  );
}
