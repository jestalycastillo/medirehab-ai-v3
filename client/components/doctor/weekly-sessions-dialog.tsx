"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CheckCircle2, ChevronRight, ClipboardList, Dumbbell, ExternalLink, Search, Sparkles, User, X } from "lucide-react";
import { type ApiPatient, type ExerciseAssignment } from "@/lib/api";
import { Button } from "@/components/ui/button";

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

function patientInitials(patient: ApiPatient) {
  const name = patientName(patient);
  return name.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase();
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
  const [searchQuery, setSearchQuery] = useState("");
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
    const query = searchQuery.trim().toLowerCase();
    return patientStats.filter((item) => {
      const name = patientName(item.patient).toLowerCase();
      const email = item.patient.email.toLowerCase();
      const condition = (item.patient.profile?.medicalCondition || "").toLowerCase();
      const matchesSearch = !query || name.includes(query) || email.includes(query) || condition.includes(query);
      const matchesFilter = filterStatus === "ALL" || item.status === filterStatus;
      return matchesSearch && matchesFilter;
    });
  }, [filterStatus, patientStats, searchQuery]);

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
            <span className="weekly-sessions-badge">
              <ClipboardList style={{ width: 14, height: 14 }} /> Telemetry
            </span>
            <h2 id="weekly-sessions-title">This Week&apos;s Planned Sessions</h2>
            <p>Session completion telemetry and prescription adherence for active patients.</p>
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

        {/* Filter Controls & Search */}
        <div className="weekly-sessions-controls">
          <div className="weekly-sessions-search-box">
            <Search style={{ width: 16, height: 16, color: "var(--color-text-muted)" }} />
            <input
              type="text"
              placeholder="Search by patient name, email, or condition…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="weekly-sessions-search-input"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="weekly-sessions-clear-search"
                aria-label="Clear search"
              >
                <X style={{ width: 14, height: 14 }} />
              </button>
            )}
          </div>

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
              Goals Met ({counts.met})
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
              <p>No patients match the selected filter or search query.</p>
            </div>
          ) : (
            filteredStats.map(({ patient, assignments, completed, target, percent, status }) => {
              const fullName = patientName(patient);
              const initials = patientInitials(patient);

              return (
                <div key={patient.id} className="weekly-sessions-patient-card">
                  <div className="weekly-sessions-patient-header">
                    <div className="weekly-sessions-patient-profile">
                      <span className="doctor-patient-avatar">{initials}</span>
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

                    <div className="weekly-sessions-status-badge-wrap">
                      {status === "MET" && (
                        <span className="badge badge-success" style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                          <CheckCircle2 style={{ width: 12, height: 12 }} /> Goal Met ({completed}/{target})
                        </span>
                      )}
                      {status === "IN_PROGRESS" && (
                        <span className="badge badge-blue">
                          In Progress ({completed}/{target})
                        </span>
                      )}
                      {status === "NOT_STARTED" && (
                        <span className="badge badge-amber">
                          0 of {target} Sessions
                        </span>
                      )}
                      {status === "NO_PLAN" && (
                        <span className="badge" style={{ backgroundColor: "#f1f5f9", color: "#64748b" }}>
                          No Active Plan
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Individual Patient Progress Bar */}
                  {target > 0 && (
                    <div className="weekly-sessions-patient-progress-row">
                      <div className="weekly-sessions-patient-progress-track">
                        <div
                          className={`weekly-sessions-patient-progress-bar ${
                            status === "MET" ? "is-met" : status === "IN_PROGRESS" ? "is-in-progress" : "is-zero"
                          }`}
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                      <span className="weekly-sessions-patient-progress-percent">{percent}%</span>
                    </div>
                  )}

                  {/* Exercise assignments breakdown */}
                  {assignments.length > 0 ? (
                    <div className="weekly-sessions-exercise-pills">
                      {assignments.map((assignment) => {
                        const exCompleted = assignment.adherence?.currentWeek?.completed ?? 0;
                        const exTarget = assignment.adherence?.currentWeek?.target ?? assignment.targetSessionsPerWeek ?? 0;
                        const exDays = (assignment.scheduledDays || [])
                          .map((d) => WEEKDAY_LABELS[d] || `Day ${d}`)
                          .join(", ");

                        return (
                          <div key={assignment.id} className="weekly-sessions-exercise-pill">
                            <Dumbbell style={{ width: 13, height: 13, color: "var(--color-primary)" }} />
                            <span className="weekly-sessions-exercise-pill-name">{assignment.exercise?.name || "Exercise"}</span>
                            {exDays && <span className="weekly-sessions-exercise-pill-days">({exDays})</span>}
                            <strong className="weekly-sessions-exercise-pill-count">
                              {exCompleted}/{exTarget}
                            </strong>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="weekly-sessions-no-plan-notice">
                      <span>No exercise prescriptions assigned for this patient.</span>
                    </div>
                  )}

                  {/* Action Links */}
                  <div className="weekly-sessions-patient-actions">
                    <Link
                      href={`/doctor/patients/${patient.id}`}
                      className="weekly-sessions-action-link"
                      onClick={onClose}
                    >
                      View Profile & Sessions <ChevronRight style={{ width: 13, height: 13 }} />
                    </Link>
                    <Link
                      href={`/doctor/patients/${patient.id}/exercises`}
                      className="weekly-sessions-action-link secondary"
                      onClick={onClose}
                    >
                      Manage Exercises <ExternalLink style={{ width: 12, height: 12 }} />
                    </Link>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Modal Footer */}
        <div className="weekly-sessions-modal-footer">
          <Link
            href="/doctor/exercise-assignments"
            className="weekly-sessions-footer-link"
            onClick={onClose}
          >
            <Sparkles style={{ width: 14, height: 14 }} /> Open All Exercise Assignments
          </Link>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
