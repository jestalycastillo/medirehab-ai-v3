"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Activity, ChevronRight, CircleAlert, Dumbbell, LoaderCircle, Plus, Stethoscope, UsersRound } from "lucide-react";
import { api, type ApiDoctor, type ApiExercise, type ApiPatient, type AuditLog, type CareSession, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

function getLocalDateKey(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function buildActivityDays(sessions: CareSession[], days = 7) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const counts = new Map<string, number>();

  sessions.forEach((session) => {
    const key = getLocalDateKey(new Date(session.performedAt));
    counts.set(key, (counts.get(key) ?? 0) + 1);
  });

  return Array.from({ length: days }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() - (days - 1 - index));
    return {
      label: new Intl.DateTimeFormat("en", { weekday: "short" }).format(date),
      value: counts.get(getLocalDateKey(date)) ?? 0,
    };
  });
}

function describeAudit(log: AuditLog) {
  const action = log.method === "POST" ? "Created" : log.method === "DELETE" ? "Removed" : log.method === "PATCH" || log.method === "PUT" ? "Updated" : "Viewed";
  const area = log.path.includes("doctor") ? "doctor account"
    : log.path.includes("patient") ? "patient account"
      : log.path.includes("exercise") ? "exercise"
        : log.path.includes("consent") ? "consent settings"
          : "system record";
  return `${action} ${area}`;
}

function formatAuditTime(value: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
  }).format(new Date(value));
}

export default function AdminDashboard() {
  const [doctors, setDoctors] = useState<ApiDoctor[]>([]);
  const [patients, setPatients] = useState<ApiPatient[]>([]);
  const [exercises, setExercises] = useState<ApiExercise[]>([]);
  const [sessions, setSessions] = useState<CareSession[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;

    async function loadData() {
      try {
        const [docsRes, patientsRes, exRes, sessionsRes, auditRes] = await Promise.all([
          api.getDoctors(), api.getAdminPatients(), api.getExercises(), api.getAdminCareSessions(), api.getAuditLogs(),
        ]);
        if (mounted) {
          setDoctors(docsRes.doctors);
          setPatients(patientsRes.patients);
          setExercises(exRes.exercises);
          setSessions(sessionsRes.sessions);
          setAuditLogs(auditRes.logs);
        }
      } catch (err) {
        if (mounted) setError(err instanceof ApiError ? err.message : "Failed to load dashboard data.");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadData();
    return () => { mounted = false; };
  }, []);

  const dashboard = useMemo(() => {
    const activeDoctors = doctors.filter((doctor) => doctor.isActive && !doctor.archivedAt);
    const activePatients = patients.filter((patient) => patient.isActive && !patient.archivedAt);
    const activeExercises = exercises.filter((exercise) => !exercise.archivedAt);
    const patientsWithoutDoctor = activePatients.filter((patient) => !patient.profile?.assignedDoctor?.user?.id);
    const inactiveDoctors = doctors.filter((doctor) => !doctor.isActive && !doctor.archivedAt);
    const activityDays = buildActivityDays(sessions);
    const activityTotal = activityDays.reduce((sum, day) => sum + day.value, 0);
    const maxActivity = Math.max(1, ...activityDays.map((day) => day.value));
    return { activeDoctors, activePatients, activeExercises, patientsWithoutDoctor, inactiveDoctors, activityDays, activityTotal, maxActivity };
  }, [doctors, exercises, patients, sessions]);

  if (loading) {
    return (
      <div className="role-dashboard-loading" role="status" aria-label="Loading admin dashboard">
        <LoaderCircle className="recorder-spin" />
        <span>Loading platform overview…</span>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="role-dashboard-error" role="alert">
        <CardContent className="role-dashboard-error-content">
          <CircleAlert aria-hidden="true" />
          <div><CardTitle>We could not load the dashboard</CardTitle><CardDescription>{error}</CardDescription></div>
          <Button onClick={() => window.location.reload()}>Try again</Button>
        </CardContent>
      </Card>
    );
  }

  const setupIssueCount = dashboard.patientsWithoutDoctor.length + dashboard.inactiveDoctors.length;

  return (
    <div className="role-dashboard admin-simple-dashboard animate-fade-in">
      <header className="role-dashboard-header">
        <div>
          <span className="role-dashboard-eyebrow">Admin dashboard</span>
          <h1>Platform overview</h1>
          <p>Manage care accounts and keep the exercise library ready.</p>
        </div>
        <div className="role-dashboard-actions">
          <Button variant="outline" nativeButton={false} render={<Link href="/admin/doctors" />}><Stethoscope aria-hidden="true" /> Manage doctors</Button>
          <Button nativeButton={false} render={<Link href="/admin/patients?create=1" />}><Plus aria-hidden="true" /> Create patient</Button>
        </div>
      </header>

      <Card className="admin-overview-card">
        <CardHeader>
          <span className="role-dashboard-eyebrow">Start here</span>
          <CardTitle>Needs setup</CardTitle>
          <CardDescription>{setupIssueCount > 0 ? `${setupIssueCount} item${setupIssueCount === 1 ? "" : "s"} to check` : "No account setup issues"}</CardDescription>
        </CardHeader>
        <CardContent className="admin-setup-list">
            {setupIssueCount === 0 ? (
              <div className="admin-setup-clear"><strong>Everything is ready</strong><p>Active patients have a doctor and accounts are ready to use.</p></div>
            ) : (
              <>
                {dashboard.patientsWithoutDoctor.length > 0 && (
                  <Link href="/admin/patients"><span>Patients without a doctor</span><strong>{dashboard.patientsWithoutDoctor.length}</strong><ChevronRight /></Link>
                )}
                {dashboard.inactiveDoctors.length > 0 && (
                  <Link href="/admin/doctors"><span>Inactive doctors</span><strong>{dashboard.inactiveDoctors.length}</strong><ChevronRight /></Link>
                )}
              </>
            )}
        </CardContent>
      </Card>

      <nav className="role-dashboard-quick-links" aria-label="Admin overview">
        <Link href="/admin/doctors"><Stethoscope aria-hidden="true" /><span>Doctors</span><strong>{dashboard.activeDoctors.length} active</strong><ChevronRight aria-hidden="true" /></Link>
        <Link href="/admin/patients"><UsersRound aria-hidden="true" /><span>Patients</span><strong>{dashboard.activePatients.length} active</strong><ChevronRight aria-hidden="true" /></Link>
        <Link href="/admin/exercises"><Dumbbell aria-hidden="true" /><span>Exercises</span><strong>{dashboard.activeExercises.length} available</strong><ChevronRight aria-hidden="true" /></Link>
      </nav>

      <details className="role-dashboard-disclosure">
        <summary><span>Activity and recent changes</span><span>{dashboard.activityTotal} sessions this week</span><ChevronRight aria-hidden="true" /></summary>
        <div className="role-dashboard-disclosure-content">
        <Card className="role-summary-card">
          <CardHeader>
            <div className="role-summary-heading">
              <span className="role-summary-icon"><Activity /></span>
              <div><CardTitle>Care activity</CardTitle><CardDescription>Exercise sessions in the last 7 days</CardDescription></div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="admin-activity-total"><strong>{dashboard.activityTotal}</strong><span>sessions completed</span></div>
            <div className="admin-activity-bars" aria-label={`${dashboard.activityTotal} sessions in the last seven days`}>
              {dashboard.activityDays.map((day) => (
                <div key={day.label}><i style={{ height: `${Math.max(8, (day.value / dashboard.maxActivity) * 100)}%` }} /><strong>{day.value}</strong><span>{day.label}</span></div>
              ))}
            </div>
          </CardContent>
        </Card>

      <Card className="admin-audit-card">
        <CardHeader className="admin-audit-header">
          <div><CardTitle>Recent changes</CardTitle><CardDescription>The latest account and care updates</CardDescription></div>
        </CardHeader>
        <CardContent className="admin-audit-list">
          {auditLogs.length === 0 ? (
            <p className="role-no-update">No recorded changes yet.</p>
          ) : auditLogs.slice(0, 5).map((log) => (
            <div className="admin-audit-row" key={log.id}>
              <span className={log.statusCode < 400 ? "admin-audit-success" : "admin-audit-failed"} aria-hidden="true" />
              <div><strong>{describeAudit(log)}</strong><small>{log.actor?.email ?? "Former user"} · {log.statusCode < 400 ? "Succeeded" : "Failed"}</small></div>
              <time>{formatAuditTime(log.createdAt)}</time>
            </div>
          ))}
        </CardContent>
      </Card>
        </div>
      </details>
    </div>
  );
}
