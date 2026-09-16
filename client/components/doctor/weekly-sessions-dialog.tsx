"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Calendar, Check, CircleAlert, ClipboardList, Clock, Dumbbell, Target, User, X } from "lucide-react";
import { type ApiPatient, type ExerciseAssignment } from "@/lib/api";

const WEEKDAY_LABELS: Record<number, string> = {
  1: "Mon",
  2: "Tue",
  3: "Wed",
  4: "Thu",
  5: "Fri",
  6: "Sat",
  7: "Sun",
};

function patientName(patient: ApiPatient) {
  const name = [patient.profile?.firstName, patient.profile?.lastName].filter(Boolean).join(" ");
  return name || patient.email;
}

type FilterStatus = "ALL" | "MET" | "IN_PROGRESS" | "NOT_STARTED" | "NO_PLAN";

export function WeeklySessionsDialog({
  isOpen,
  onClose,
  patients,
  assignmentsByPatient,
  weeklyCompleted,
  weeklyTarget,
}: {
  isOpen: boolean;
  onClose: () => void;
  patients: ApiPatient[];
  assignmentsByPatient: Record<string, ExerciseAssignment[]>;
  weeklyCompleted: number;
  weeklyTarget: number;
}) {
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("ALL");

  const patientStats = useMemo(() => {
    return patients
      .filter((p) => p.isActive && !p.archivedAt)
      .map((patient) => {
        const assignments = assignmentsByPatient[patient.id] ?? [];
        const completed = assignments.reduce((sum, a) => sum + (a.adherence?.currentWeek?.completed ?? 0), 0);
        const target = assignments.reduce(
          (sum, a) => sum + (a.adherence?.currentWeek?.target ?? a.targetSessionsPerWeek ?? 0),
          0
        );
        const percent = target > 0 ? Math.min(100, Math.round((completed / target) * 100)) : 0;

        let status: "MET" | "IN_PROGRESS" | "NOT_STARTED" | "NO_PLAN" = "NOT_STARTED";
        if (assignments.length === 0) {
          status = "NO_PLAN";
        } else if (completed >= target && target > 0) {
          status = "MET";
        } else if (completed > 0) {
          status = "IN_PROGRESS";
        } else {
          status = "NOT_STARTED";
        }

        return {
          patient,
          assignments,
          completed,
          target,
          percent,
          status,
        };
      });
  }, [assignmentsByPatient, patients]);

  const counts = useMemo(() => {
    return {
      all: patientStats.length,
      met: patientStats.filter((p) => p.status === "MET").length,
      inProgress: patientStats.filter((p) => p.status === "IN_PROGRESS").length,
      notStarted: patientStats.filter((p) => p.status === "NOT_STARTED").length,
      noPlan: patientStats.filter((p) => p.status === "NO_PLAN").length,
    };
  }, [patientStats]);

  const filteredStats = useMemo(() => {
    return patientStats.filter((item) => {
      return filterStatus === "ALL" || item.status === filterStatus;
    });
  }, [filterStatus, patientStats]);

  if (!isOpen) return null;

  const overallPercent = weeklyTarget > 0 ? Math.min(100, Math.round((weeklyCompleted / weeklyTarget) * 100)) : 0;

  return (
    <div
      className="weekly-sessions-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="weekly-sessions-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="weekly-sessions-modal-container animate-fade-in">
        {/* Header */}
        <div className="weekly-sessions-modal-header">
          <div className="weekly-sessions-modal-title-group">
            <h2 id="weekly-sessions-title">This Week&apos;s Planned Sessions</h2>
          </div>
          <button
            type="button"
            className="weekly-sessions-close-btn"
            onClick={onClose}
            aria-label="Close dialog"
          >
            <X style={{ width: 18, height: 18 }} />
          </button>
        </div>

        {/* Overall Summary Bar */}
        <div className="weekly-sessions-summary-card">
          <div className="weekly-sessions-summary-metrics">
            <div className="weekly-sessions-metric-item">
              <span className="weekly-sessions-metric-label">Completed Sessions</span>
              <span className="weekly-sessions-metric-value">
                <strong>{weeklyCompleted}</strong> of {weeklyTarget} planned
              </span>
            </div>
            <div className="weekly-sessions-metric-item">
              <span className="weekly-sessions-metric-label">Weekly Completion Rate</span>
              <span className="weekly-sessions-metric-value">
                <strong>{overallPercent}%</strong> on track
              </span>
            </div>
            <div className="weekly-sessions-metric-item">
              <span className="weekly-sessions-metric-label">Active Patients</span>
              <span className="weekly-sessions-metric-value">
                <strong>{counts.all}</strong> enrolled
              </span>
            </div>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="weekly-sessions-controls">
          <div className="weekly-sessions-filter-tabs">
            <button
              type="button"
              className={`weekly-sessions-tab ${filterStatus === "ALL" ? "active" : ""}`}
              onClick={() => setFilterStatus("ALL")}
            >
              All ({counts.all})
            </button>
            <button
              type="button"
              className={`weekly-sessions-tab ${filterStatus === "MET" ? "active" : ""}`}
              onClick={() => setFilterStatus("MET")}
            >
              Completed ({counts.met})
            </button>
            <button
              type="button"
              className={`weekly-sessions-tab ${filterStatus === "IN_PROGRESS" ? "active" : ""}`}
              onClick={() => setFilterStatus("IN_PROGRESS")}
            >
              In Progress ({counts.inProgress})
            </button>
            <button
              type="button"
              className={`weekly-sessions-tab ${filterStatus === "NOT_STARTED" ? "active" : ""}`}
              onClick={() => setFilterStatus("NOT_STARTED")}
            >
              Not Started ({counts.notStarted})
            </button>
            {counts.noPlan > 0 && (
              <button
                type="button"
                className={`weekly-sessions-tab ${filterStatus === "NO_PLAN" ? "active" : ""}`}
                onClick={() => setFilterStatus("NO_PLAN")}
              >
                No Plan ({counts.noPlan})
              </button>
            )}
          </div>
        </div>

        {/* Patients List Body */}
        <div className="weekly-sessions-list-body">
          {filteredStats.length === 0 ? (
            <div className="weekly-sessions-empty">
              <User style={{ width: 32, height: 32, color: "var(--color-text-muted)", margin: "0 auto 8px" }} />
              <p>No patients match the selected filter.</p>
            </div>
          ) : (
            filteredStats.map(({ patient, assignments, completed, target, status }) => {
              const fullName = patientName(patient);

              return (
                <div key={patient.id} className="weekly-sessions-patient-card">
                  <div className="weekly-sessions-patient-header">
                    <div className="weekly-sessions-patient-profile">
                      <div>
                        <div className="weekly-sessions-patient-name">
                          <Link href={`/doctor/patients/${patient.id}`} onClick={onClose}>
                            {fullName}
                          </Link>
                        </div>
                        <div className="weekly-sessions-patient-meta">
                          {patient.profile?.medicalCondition ? (
                            <span>{patient.profile.medicalCondition}</span>
                          ) : (
                            <span>{patient.email}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Exercise assignments breakdown */}
                  {assignments.length > 0 ? (
                    <div className="weekly-sessions-exercise-list">
                      {assignments.map((assignment) => {
                        const exCompleted = assignment.adherence?.currentWeek?.completed ?? 0;
                        const exTarget = assignment.adherence?.currentWeek?.target ?? assignment.targetSessionsPerWeek ?? 0;
                        const exDays = (assignment.scheduledDays || [])
                          .map((d) => WEEKDAY_LABELS[d] || `Day ${d}`)
                          .join(", ");
                        const isMet = exCompleted >= exTarget && exTarget > 0;
                        const isInProgress = exCompleted > 0 && exCompleted < exTarget;

                        return (
                          <div key={assignment.id} className="weekly-exercise-row">
                            <div className="weekly-exercise-left">
                              <span className="weekly-exercise-name">
                                {assignment.exercise?.name || "Exercise"}
                              </span>
                              {exDays && (
                                <span className="weekly-exercise-schedule">
                                  <Calendar style={{ width: 11, height: 11 }} /> {exDays}
                                </span>
                              )}
                            </div>

                            <div className="weekly-exercise-right">
                              <span className="weekly-exercise-count-badge">
                                <strong>{exCompleted}</strong> of {exTarget} {exTarget === 1 ? "session" : "sessions"}
                              </span>
                              {isMet ? (
                                <span className="weekly-exercise-status-tag">
                                  <Check style={{ width: 11, height: 11 }} /> Completed
                                </span>
                              ) : isInProgress ? (
                                <span className="weekly-exercise-status-tag">
                                  <Clock style={{ width: 11, height: 11 }} /> In Progress
                                </span>
                              ) : (
                                <span className="weekly-exercise-status-tag">
                                  <CircleAlert style={{ width: 11, height: 11 }} /> Not Started
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="weekly-sessions-no-plan-notice">
                      <span>No exercise prescriptions assigned for this patient.</span>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
