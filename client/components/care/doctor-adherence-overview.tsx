"use client";

import Link from "next/link";
import type { ApiPatient, ExerciseAssignment } from "@/lib/api";

const patientName = (patient: ApiPatient) => [patient.profile?.firstName, patient.profile?.lastName].filter(Boolean).join(" ") || patient.email;

export function DoctorAdherenceOverview({ patients, assignmentsByPatient }: { patients: ApiPatient[]; assignmentsByPatient: Record<string, ExerciseAssignment[]> }) {
  const rows = patients.filter((patient) => patient.isActive && !patient.archivedAt).map((patient) => {
    const assignments = assignmentsByPatient[patient.id] ?? [];
    const missed = assignments.filter((assignment) => assignment.adherence?.weeklyHistory[1]?.status === "MISSED").length;
    const behind = assignments.filter((assignment) => assignment.adherence && assignment.adherence.currentWeek.status !== "MET" && assignment.adherence.currentWeek.remaining > 0).length;
    const declining = assignments.filter((assignment) => {
      const scores = (assignment.sessions ?? []).flatMap((session) => typeof session.score === "number" ? [session.score] : []);
      return scores.length >= 2 && scores[0]! + 5 < scores[1]!;
    }).length;
    const met = assignments.filter((assignment) => assignment.adherence?.currentWeek.status === "MET").length;
    const state = missed > 0 ? "MISSED" : declining > 0 ? "DECLINING" : behind > 0 ? "BEHIND" : "ON_TRACK";
    const risk = missed * 4 + declining * 3 + behind * 2;
    return { patient, assignments: assignments.length, missed, behind, declining, met, state, risk };
  }).sort((a, b) => b.risk - a.risk || patientName(a.patient).localeCompare(patientName(b.patient)));

  const badge = (state: string) => state === "ON_TRACK" ? "badge-green" : state === "MISSED" ? "badge-red" : "badge-amber";
  const label = (state: string) => state === "ON_TRACK" ? "On track" : state === "MISSED" ? "Missed" : state === "DECLINING" ? "Declining" : "Behind";

  return <section className="card" style={{ overflow: "hidden" }}>
    <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--color-border)" }}><h2 style={{ fontSize: "18px", fontWeight: 600, margin: 0 }}>Adherence Overview</h2><p style={{ margin: "4px 0 0", color: "var(--color-text-muted)", fontSize: "13px" }}>Patients needing attention appear first.</p></div>
    {rows.length === 0 ? <div style={{ padding: "28px", textAlign: "center", color: "var(--color-text-muted)" }}>No active patients to review.</div> : <div className="adherence-overview-table">
      {rows.map((row) => <div key={row.patient.id} className="adherence-overview-row">
        <div><Link href={`/doctor/patients/${row.patient.id}`} style={{ color: "var(--color-text-primary)", fontWeight: 700, textDecoration: "none" }}>{patientName(row.patient)}</Link><div style={{ color: "var(--color-text-muted)", fontSize: "12px" }}>{row.assignments} active assignment{row.assignments === 1 ? "" : "s"}</div></div>
        <span className={`badge ${badge(row.state)}`}>{label(row.state)}</span>
        <div className="adherence-overview-metrics"><span><strong>{row.met}</strong> met</span><span><strong>{row.behind}</strong> behind</span><span><strong>{row.missed}</strong> missed</span><span><strong>{row.declining}</strong> declining</span></div>
      </div>)}
    </div>}
  </section>;
}
