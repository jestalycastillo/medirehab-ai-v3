"use client";

import type { CareSession, ExerciseAssignment, HelpRequest } from "@/lib/api";
import { formatScore } from "@/lib/score";

export function DoctorAlerts({ sessions, assignments, helpRequests, lastSeenAt, onResolve }: { sessions: CareSession[]; assignments: ExerciseAssignment[]; helpRequests: HelpRequest[]; lastSeenAt?: string | null; onResolve: (id: string) => Promise<void> | void }) {
  const alerts: { id: string; title: string; detail: string; urgent?: boolean }[] = [];
  const latest = sessions[0];
  if (latest?.painLevel != null && latest.painLevel >= 7) alerts.push({ id: "pain", title: "High pain reported", detail: `${latest.painLevel}/10 in the latest check-in`, urgent: true });
  if (latest?.confidenceLevel != null && latest.confidenceLevel <= 3) alerts.push({ id: "confidence", title: "Low confidence", detail: `${latest.confidenceLevel}/10 in the latest check-in` });
  if (sessions.length >= 2 && (sessions[0].score ?? 0) + 10 < (sessions[1].score ?? 0)) alerts.push({ id: "decline", title: "Score decline", detail: `${formatScore(sessions[1].score)} to ${formatScore(sessions[0].score)}` });
  const lastSeenDays = lastSeenAt ? (Date.now() - new Date(lastSeenAt).getTime()) / 86_400_000 : Infinity;
  if (lastSeenDays >= 7) alerts.push({ id: "inactive", title: "Patient inactive", detail: lastSeenAt ? `${Math.floor(lastSeenDays)} days since last online` : "No recorded activity" });
  const overdue = assignments.filter((item) => item.dueDate && !item.completedAt && new Date(item.dueDate).getTime() < Date.now());
  if (overdue.length) alerts.push({ id: "overdue", title: "Overdue exercises", detail: `${overdue.length} assignment${overdue.length === 1 ? "" : "s"} past due` });

  return <section className="card" style={{ padding: "24px" }}>
    <h2 style={{ fontSize: "18px", fontWeight: 600, margin: "0 0 16px" }}>Care Alerts</h2>
    {helpRequests.filter((request) => !request.resolvedAt).map((request) => <div key={request.id} style={{ padding: "12px", marginBottom: "10px", backgroundColor: "#FEE2E2", borderRadius: "var(--radius-md)" }}><strong>Help requested{request.assignment?.exercise.name ? ` · ${request.assignment.exercise.name}` : ""}</strong><div style={{ fontSize: "14px", margin: "5px 0" }}>{request.message}</div><button className="btn btn-secondary" onClick={() => onResolve(request.id)}>Mark resolved</button></div>)}
    {alerts.length === 0 && helpRequests.every((request) => request.resolvedAt) ? <div style={{ color: "var(--color-text-muted)" }}>No active care alerts.</div> : alerts.map((alert) => <div key={alert.id} style={{ padding: "12px", marginBottom: "10px", backgroundColor: alert.urgent ? "#FEE2E2" : "#FEF3C7", borderRadius: "var(--radius-md)" }}><strong>{alert.title}</strong><div style={{ fontSize: "13px", marginTop: "3px" }}>{alert.detail}</div></div>)}
  </section>;
}
