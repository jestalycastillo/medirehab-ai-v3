"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Bell, ChevronRight, CircleAlert, ClipboardPlus, LoaderCircle, UserPlus, UsersRound } from "lucide-react";
import { api, ApiError, type ApiPatient, type CareNotification, type DoctorProfile, type ExerciseAssignment } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

function patientName(patient: ApiPatient) {
  return [patient.profile?.firstName, patient.profile?.lastName].filter(Boolean).join(" ") || "Unnamed patient";
}

function patientInitials(patient: ApiPatient) {
  const name = patientName(patient);
  return name.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase();
}

function formatNotificationTime(value: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
  }).format(new Date(value));
}

export default function DoctorDashboardPage() {
  const [profile, setProfile] = useState<DoctorProfile | null>(null);
  const [patients, setPatients] = useState<ApiPatient[]>([]);
  const [assignmentsByPatient, setAssignmentsByPatient] = useState<Record<string, ExerciseAssignment[]>>({});
  const [notifications, setNotifications] = useState<CareNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;

    async function loadDashboard() {
      try {
        const [profileRes, patientsRes, notificationsRes] = await Promise.all([
          api.getProfile(),
          api.getPatients(),
          api.getMyNotifications().catch(() => ({ notifications: [] })),
        ]);
        const assignmentEntries = await Promise.all(
          patientsRes.patients.map(async (patient) => {
            try {
              const res = await api.getAssignedExercises(patient.id);
              return [patient.id, res.assignments] as const;
            } catch {
              return [patient.id, []] as const;
            }
          }),
        );

        if (mounted) {
          setProfile((profileRes.user.profile as DoctorProfile) ?? null);
          setPatients(patientsRes.patients);
          setAssignmentsByPatient(Object.fromEntries(assignmentEntries));
          setNotifications(notificationsRes.notifications);
        }
      } catch (err) {
        if (mounted) setError(err instanceof ApiError ? err.message : "Failed to load dashboard data.");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadDashboard();
    return () => { mounted = false; };
  }, []);

  const dashboard = useMemo(() => {
    const activePatients = patients.filter((patient) => patient.isActive && !patient.archivedAt);
    const attention = activePatients.map((patient) => {
      const assignments = assignmentsByPatient[patient.id] ?? [];
      const missed = assignments.filter((assignment) => {
        const primary = assignment.adherence?.today ?? assignment.adherence?.currentWeek;
        return primary?.status === "MISSED";
      }).length;
      return { patient, missed, needsPlan: assignments.length === 0 };
    }).filter((item) => item.missed > 0 || item.needsPlan)
      .sort((left, right) => right.missed - left.missed || Number(right.needsPlan) - Number(left.needsPlan));

    const weeklyCompleted = Object.values(assignmentsByPatient).flat().reduce(
      (sum, assignment) => sum + (assignment.adherence?.currentWeek.completed ?? 0), 0,
    );
    const weeklyTarget = Object.values(assignmentsByPatient).flat().reduce(
      (sum, assignment) => sum + (assignment.adherence?.currentWeek.target ?? assignment.targetSessionsPerWeek ?? 0), 0,
    );
    const weeklyPercentage = weeklyTarget > 0 ? Math.min(100, Math.round((weeklyCompleted / weeklyTarget) * 100)) : 0;
    const unreadNotifications = notifications.filter((notification) => !notification.isRead);

    return { activePatients, attention, weeklyCompleted, weeklyTarget, weeklyPercentage, unreadNotifications };
  }, [assignmentsByPatient, notifications, patients]);

  if (loading) {
    return (
      <div className="role-dashboard-loading" aria-label="Loading doctor dashboard">
        <LoaderCircle className="recorder-spin" />
        <span>Loading your patients…</span>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="role-dashboard-error">
        <CardContent className="role-dashboard-error-content">
          <CircleAlert aria-hidden="true" />
          <div><CardTitle>We could not load your dashboard</CardTitle><CardDescription>{error}</CardDescription></div>
          <Button onClick={() => window.location.reload()}>Try again</Button>
        </CardContent>
      </Card>
    );
  }

  const doctorName = [profile?.firstName, profile?.lastName].filter(Boolean).join(" ");
  const latestUpdate = dashboard.unreadNotifications[0] ?? notifications[0];

  return (
    <div className="role-dashboard animate-fade-in">
      <header className="role-dashboard-header">
        <div>
          <span className="role-dashboard-eyebrow">Doctor dashboard</span>
          <h1>{doctorName ? `Hello, Dr. ${doctorName}` : "Hello, Doctor"}</h1>
          <p>Start with the patients who need you most.</p>
        </div>
        <div className="role-dashboard-actions">
          <Button variant="outline" render={<Link href="/doctor/exercise-assignments" />}>
            <ClipboardPlus aria-hidden="true" /> Assign exercise
          </Button>
          <Button render={<Link href="/doctor/patients" />}>
            <UserPlus aria-hidden="true" /> Add patient
          </Button>
        </div>
      </header>

      <Card className="doctor-attention-card">
        <CardHeader className="doctor-attention-header">
          <div>
            <span className="role-dashboard-eyebrow">Start here</span>
            <CardTitle>Patients needing attention</CardTitle>
            <CardDescription>
              {dashboard.attention.length > 0
                ? `${dashboard.attention.length} patient${dashboard.attention.length === 1 ? "" : "s"} may need follow-up`
                : "No missed goals or unfinished care plans"}
            </CardDescription>
          </div>
          <Button variant="ghost" render={<Link href="/doctor/patients" />}>All patients <ChevronRight /></Button>
        </CardHeader>
        <CardContent className="doctor-attention-list">
          {dashboard.attention.length === 0 ? (
            <div className="doctor-all-clear">
              <span><UsersRound /></span>
              <div><strong>Everyone is on track</strong><p>There is nothing urgent to review right now.</p></div>
            </div>
          ) : dashboard.attention.slice(0, 4).map(({ patient, missed, needsPlan }) => (
            <Link className="doctor-attention-row" href={`/doctor/patients/${patient.id}`} key={patient.id}>
              <span className="doctor-patient-avatar">{patientInitials(patient)}</span>
              <span className="doctor-patient-copy">
                <strong>{patientName(patient)}</strong>
                <small>{needsPlan ? "Exercise plan not set up" : `${missed} missed exercise goal${missed === 1 ? "" : "s"}`}</small>
              </span>
              <span className={needsPlan ? "doctor-attention-plan" : "doctor-attention-missed"}>
                {needsPlan ? "Set up plan" : "Review"}
              </span>
              <ChevronRight aria-hidden="true" />
            </Link>
          ))}
        </CardContent>
      </Card>

      <div className="role-dashboard-summary-grid">
        <Card className="role-summary-card">
          <CardHeader>
            <div className="role-summary-heading">
              <span className="role-summary-icon"><UsersRound /></span>
              <div><CardTitle>Your patients</CardTitle><CardDescription>{dashboard.activePatients.length} currently active</CardDescription></div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="doctor-care-number"><strong>{dashboard.weeklyCompleted}</strong><span>of {dashboard.weeklyTarget || "—"} planned sessions completed this week</span></div>
            <div className="role-progress"><span style={{ width: `${dashboard.weeklyPercentage}%` }} /></div>
            <div className="role-progress-footer"><span>{dashboard.weeklyPercentage}% complete</span><Link href="/doctor/patients">Open patient list</Link></div>
          </CardContent>
        </Card>

        <Card className="role-summary-card">
          <CardHeader>
            <div className="role-summary-heading">
              <span className="role-summary-icon"><Bell /></span>
              <div><CardTitle>Updates</CardTitle><CardDescription>{dashboard.unreadNotifications.length > 0 ? `${dashboard.unreadNotifications.length} unread` : "You are all caught up"}</CardDescription></div>
            </div>
          </CardHeader>
          <CardContent className="role-update-content">
            {latestUpdate ? (
              <div className="role-latest-update"><strong>{latestUpdate.title}</strong><p>{latestUpdate.body}</p><span>{formatNotificationTime(latestUpdate.createdAt)}</span></div>
            ) : <p className="role-no-update">Patient results, notes, and requests will appear here.</p>}
            <Button variant="ghost" render={<Link href="/doctor/notifications" />}>View updates <ChevronRight /></Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
