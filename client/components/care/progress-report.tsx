"use client";

import type { CareSession, ExerciseAssignment } from "@/lib/api";
import { formatScore } from "@/lib/score";

export function ProgressReport({ sessions, assignments, subjectName }: { sessions: CareSession[]; assignments: ExerciseAssignment[]; subjectName: string }) {
  const reportStart = assignments.flatMap((assignment) => assignment.adherence?.last30Days.periodStart ? [assignment.adherence.last30Days.periodStart] : []).sort()[0];
  const recent = reportStart ? sessions.filter((session) => new Date(session.performedAt).getTime() >= new Date(`${reportStart}T00:00:00Z`).getTime()) : [];
  const scores = recent.flatMap((session) => typeof session.score === "number" ? [session.score] : []);
  const pain = recent.flatMap((session) => typeof session.painLevel === "number" ? [session.painLevel] : []);
  const average = scores.length ? scores.reduce((sum, value) => sum + value, 0) / scores.length : 0;
  const averagePain = pain.length ? pain.reduce((sum, value) => sum + value, 0) / pain.length : 0;
  const adherenceCompleted = assignments.reduce((sum, assignment) => sum + (assignment.adherence?.last30Days.completed ?? 0), 0);
  const adherenceTarget = assignments.reduce((sum, assignment) => sum + (assignment.adherence?.last30Days.target ?? 0), 0);
  const adherence = adherenceTarget ? Math.min(100, (adherenceCompleted / adherenceTarget) * 100) : 0;
  const metThisWeek = assignments.filter((assignment) => assignment.adherence?.currentWeek.status === "MET").length;

  const downloadCsv = () => {
    const rows = [["Patient", "Exercise", "Arm", "Performed", "Score", "Pain", "Difficulty", "Confidence", "Note"], ...recent.map((session) => [subjectName, session.assignment.exercise.name, session.selectedSide ?? "", session.performedAt, formatScore(session.score), session.painLevel ?? "", session.difficultyLevel ?? "", session.confidenceLevel ?? "", session.patientNote ?? ""] )];
    const csv = rows.map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url; link.download = `${subjectName.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-progress.csv`; link.click(); URL.revokeObjectURL(url);
  };

  return <section className="card" style={{ padding: "24px" }}>
    <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "center", flexWrap: "wrap", marginBottom: "16px" }}><div><h2 style={{ fontSize: "18px", fontWeight: 600, margin: 0 }}>30-Day Progress Report</h2><p style={{ margin: "4px 0 0", color: "var(--color-text-muted)", fontSize: "13px" }}>{subjectName}</p></div><div style={{ display: "flex", gap: "8px" }}><button className="btn btn-secondary" onClick={downloadCsv}>Export CSV</button><button className="btn btn-primary" onClick={() => window.print()}>Print / Save PDF</button></div></div>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "12px" }}>
      <div><small>Sessions</small><div style={{ fontSize: "22px", fontWeight: 700 }}>{recent.length}</div></div>
      <div><small>Average score</small><div style={{ fontSize: "22px", fontWeight: 700 }}>{formatScore(average)}</div></div>
      <div><small>Average pain</small><div style={{ fontSize: "22px", fontWeight: 700 }}>{averagePain.toFixed(1)}/10</div></div>
      <div><small>30-day adherence</small><div style={{ fontSize: "22px", fontWeight: 700 }}>{adherence.toFixed(0)}%</div><small>{adherenceCompleted}/{adherenceTarget} required sessions</small></div>
      <div><small>Weekly goals met</small><div style={{ fontSize: "22px", fontWeight: 700 }}>{metThisWeek}/{assignments.length}</div></div>
    </div>
  </section>;
}
