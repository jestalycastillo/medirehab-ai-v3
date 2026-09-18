"use client";

import { useMemo } from "react";
import type { CareSession, ExerciseAssignment } from "@/lib/api";
import { formatScore } from "@/lib/score";

function formatReportDateTime(value?: string | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatReportDate(value?: string | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

export function ProgressReport({
  sessions,
  assignments,
  subjectName,
}: {
  sessions: CareSession[];
  assignments: ExerciseAssignment[];
  subjectName?: string;
}) {
  const effectiveSubjectName = subjectName?.trim() || "Patient Rehabilitation Progress";

  const reportStart = assignments
    .flatMap((assignment) => (assignment.adherence?.last30Days.periodStart ? [assignment.adherence.last30Days.periodStart] : []))
    .sort()[0];

  const recent = useMemo(() => {
    const list = reportStart
      ? sessions.filter((session) => new Date(session.performedAt).getTime() >= new Date(`${reportStart}T00:00:00Z`).getTime())
      : sessions;
    return [...list].sort((a, b) => new Date(b.performedAt).getTime() - new Date(a.performedAt).getTime());
  }, [sessions, reportStart]);

  const visitCount = new Set(recent.map((session) => session.visitId ?? session.id)).size;
  const scores = recent.flatMap((session) => (typeof session.score === "number" ? [session.score] : []));
  const pain = recent.flatMap((session) => (typeof session.painLevel === "number" ? [session.painLevel] : []));
  const average = scores.length ? scores.reduce((sum, value) => sum + value, 0) / scores.length : 0;
  const averagePain = pain.length ? pain.reduce((sum, value) => sum + value, 0) / pain.length : 0;
  const adherenceCompleted = assignments.reduce((sum, assignment) => sum + (assignment.adherence?.last30Days.completed ?? 0), 0);
  const adherenceTarget = assignments.reduce((sum, assignment) => sum + (assignment.adherence?.last30Days.target ?? 0), 0);
  const adherence = adherenceTarget ? Math.min(100, (adherenceCompleted / adherenceTarget) * 100) : 0;
  const metThisWeek = assignments.filter((assignment) => assignment.adherence?.currentWeek.status === "MET").length;

  const downloadCsv = () => {
    const rows = [
      ["Patient", "Exercise", "Arm", "Performed At", "Score", "Pain (0-10)", "Difficulty (0-10)", "Confidence (0-10)", "AI Feedback", "Patient Note"],
      ...recent.map((session) => [
        effectiveSubjectName,
        session.assignment?.exercise?.name || "Exercise",
        session.selectedSide ? (session.selectedSide === "left" ? "Left Arm" : "Right Arm") : "Both",
        formatReportDateTime(session.performedAt),
        session.score !== null ? formatScore(session.score) : "Unscored",
        session.painLevel ?? "",
        session.difficultyLevel ?? "",
        session.confidenceLevel ?? "",
        session.aiFeedback?.join(" | ") || "",
        session.patientNote ?? "",
      ]),
    ];
    const csv = rows.map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `${effectiveSubjectName.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-progress-report.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <section className="card progress-report-container" style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* Formal Document Header */}
      <div className="progress-doc-letterhead" style={{ borderBottom: "2px solid #000000", paddingBottom: "12px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "16px", marginBottom: "8px" }}>
          <h1 style={{ fontSize: "18px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.02em", margin: 0, color: "#000000" }}>
            Patient Rehabilitation Progress Report
          </h1>
          <div className="no-print" style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            <button type="button" className="btn btn-secondary" onClick={downloadCsv}>
              Export CSV
            </button>
            <button type="button" className="btn btn-primary" onClick={handlePrint}>
              Print / Save PDF
            </button>
          </div>
        </div>

        {/* Patient & Document Metadata Table */}
        <table className="progress-doc-meta-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px", marginTop: "8px" }}>
          <tbody>
            <tr>
              <td style={{ padding: "4px 8px 4px 0", width: "15%", fontWeight: 700, color: "#111827" }}>Patient Name:</td>
              <td style={{ padding: "4px 16px 4px 0", width: "35%", color: "#000000", fontWeight: 600 }}>{effectiveSubjectName}</td>
              <td style={{ padding: "4px 8px 4px 0", width: "18%", fontWeight: 700, color: "#111827" }}>Report Date:</td>
              <td style={{ padding: "4px 0", width: "32%", color: "#000000" }}>{formatReportDate(new Date().toISOString())}</td>
            </tr>
            <tr>
              <td style={{ padding: "4px 8px 4px 0", fontWeight: 700, color: "#111827" }}>Reporting Period:</td>
              <td style={{ padding: "4px 16px 4px 0", color: "#000000" }}>
                {reportStart ? `Last 30 Days (Since ${formatReportDate(reportStart)})` : "All Recorded Sessions"}
              </td>
              <td style={{ padding: "4px 8px 4px 0", fontWeight: 700, color: "#111827" }}>Active Care Plans:</td>
              <td style={{ padding: "4px 0", color: "#000000" }}>{assignments.length} Prescribed Plan{assignments.length === 1 ? "" : "s"}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Section I: Clinical Summary & Adherence Telemetry */}
      <div className="progress-doc-section">
        <h2 className="progress-doc-section-heading" style={{ fontSize: "13px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.04em", margin: "0 0 8px 0", color: "#000000", borderBottom: "1px solid #D1D5DB", paddingBottom: "4px" }}>
          I. Clinical Summary & Adherence Telemetry
        </h2>
        <table className="progress-doc-summary-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
          <tbody>
            <tr style={{ borderBottom: "1px solid #E5E7EB" }}>
              <td style={{ padding: "6px 8px", width: "40%", fontWeight: 600, color: "#374151" }}>Total Exercise Sessions Recorded</td>
              <td style={{ padding: "6px 8px", fontWeight: 700, color: "#000000" }}>{visitCount} visit days ({recent.length} recorded exercise clips)</td>
            </tr>
            <tr style={{ borderBottom: "1px solid #E5E7EB" }}>
              <td style={{ padding: "6px 8px", fontWeight: 600, color: "#374151" }}>Average Overall Performance Score</td>
              <td style={{ padding: "6px 8px", fontWeight: 700, color: "#000000" }}>{scores.length > 0 ? `${formatScore(average)} / 100 (${scores.length} scored clips)` : "N/A"}</td>
            </tr>
            <tr style={{ borderBottom: "1px solid #E5E7EB" }}>
              <td style={{ padding: "6px 8px", fontWeight: 600, color: "#374151" }}>Average Self-Reported Pain Level</td>
              <td style={{ padding: "6px 8px", fontWeight: 700, color: "#000000" }}>{pain.length > 0 ? `${averagePain.toFixed(1)} / 10 (VAS Pain Scale)` : "None reported"}</td>
            </tr>
            <tr style={{ borderBottom: "1px solid #E5E7EB" }}>
              <td style={{ padding: "6px 8px", fontWeight: 600, color: "#374151" }}>30-Day Prescription Adherence</td>
              <td style={{ padding: "6px 8px", fontWeight: 700, color: "#000000" }}>{adherence.toFixed(0)}% ({adherenceCompleted} of {adherenceTarget} prescribed sessions completed)</td>
            </tr>
            <tr>
              <td style={{ padding: "6px 8px", fontWeight: 600, color: "#374151" }}>Weekly Prescription Goals Met</td>
              <td style={{ padding: "6px 8px", fontWeight: 700, color: "#000000" }}>{metThisWeek} of {assignments.length} active plans currently meeting weekly targets</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Section II: Detailed Exercise Performance & Session Records */}
      <div className="progress-doc-section progress-report-results-section">
        <h2 className="progress-doc-section-heading progress-report-section-title" style={{ fontSize: "13px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.04em", margin: "0 0 8px 0", color: "#000000", borderBottom: "1px solid #D1D5DB", paddingBottom: "4px" }}>
          II. Session Telemetry & Clinical Observations ({recent.length} Total Records)
        </h2>

        {recent.length === 0 ? (
          <div style={{ padding: "16px", color: "#4B5563", fontSize: "12px", border: "1px solid #E5E7EB" }}>
            No rehabilitation exercise sessions recorded during this period.
          </div>
        ) : (
          <div className="progress-report-table-wrap">
            <table className="progress-report-table progress-doc-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: "11.5px", textAlign: "left" }}>
              <thead>
                <tr style={{ borderBottom: "1.5px solid #000000", borderTop: "1px solid #000000" }}>
                  <th style={{ padding: "8px 6px", fontWeight: 700, color: "#000000", width: "14%" }}>Date & Time</th>
                  <th style={{ padding: "8px 6px", fontWeight: 700, color: "#000000", width: "16%" }}>Exercise</th>
                  <th style={{ padding: "8px 6px", fontWeight: 700, color: "#000000", width: "9%" }}>Side</th>
                  <th style={{ padding: "8px 6px", fontWeight: 700, color: "#000000", width: "9%" }}>Score</th>
                  <th style={{ padding: "8px 6px", fontWeight: 700, color: "#000000", width: "8%" }}>Pain</th>
                  <th style={{ padding: "8px 6px", fontWeight: 700, color: "#000000", width: "8%" }}>Diff.</th>
                  <th style={{ padding: "8px 6px", fontWeight: 700, color: "#000000", width: "8%" }}>Conf.</th>
                  <th style={{ padding: "8px 6px", fontWeight: 700, color: "#000000", width: "28%" }}>Clinical AI Feedback & Patient Notes</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((session) => (
                  <tr
                    key={session.id}
                    className="progress-report-table-row"
                    style={{
                      borderBottom: "1px solid #E5E7EB",
                    }}
                  >
                    <td style={{ padding: "8px 6px", whiteSpace: "nowrap", color: "#111827", verticalAlign: "top" }}>
                      {formatReportDateTime(session.performedAt)}
                    </td>
                    <td style={{ padding: "8px 6px", fontWeight: 600, color: "#000000", verticalAlign: "top" }}>
                      {session.assignment?.exercise?.name || "Exercise"}
                    </td>
                    <td style={{ padding: "8px 6px", color: "#111827", verticalAlign: "top" }}>
                      {session.selectedSide ? (session.selectedSide === "left" ? "Left Arm" : "Right Arm") : "Both"}
                    </td>
                    <td style={{ padding: "8px 6px", fontWeight: 700, color: "#000000", verticalAlign: "top" }}>
                      {session.score !== null ? `${formatScore(session.score)} / 100` : "Unscored"}
                    </td>
                    <td style={{ padding: "8px 6px", color: "#111827", verticalAlign: "top" }}>
                      {session.painLevel !== null && session.painLevel !== undefined ? `${session.painLevel} / 10` : "—"}
                    </td>
                    <td style={{ padding: "8px 6px", color: "#111827", verticalAlign: "top" }}>
                      {session.difficultyLevel !== null && session.difficultyLevel !== undefined ? `${session.difficultyLevel} / 10` : "—"}
                    </td>
                    <td style={{ padding: "8px 6px", color: "#111827", verticalAlign: "top" }}>
                      {session.confidenceLevel !== null && session.confidenceLevel !== undefined ? `${session.confidenceLevel} / 10` : "—"}
                    </td>
                    <td style={{ padding: "8px 6px", color: "#111827", verticalAlign: "top" }}>
                      {session.aiFeedback && session.aiFeedback.length > 0 ? (
                        <ul style={{ margin: "0 0 4px 0", paddingLeft: "14px", fontSize: "11px", lineHeight: "1.35", color: "#111827" }}>
                          {session.aiFeedback.map((fb, fbIdx) => (
                            <li key={`${session.id}-fb-${fbIdx}`} style={{ marginBottom: "2px" }}>
                              {fb}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <span style={{ color: "#6B7280", fontSize: "11px" }}>No automated cues recorded</span>
                      )}
                      {session.patientNote && (
                        <div style={{ fontSize: "11px", color: "#374151", fontStyle: "italic", marginTop: "2px" }}>
                          Patient Note: &ldquo;{session.patientNote}&rdquo;
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}

