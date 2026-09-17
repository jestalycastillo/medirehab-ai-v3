"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Bell, CalendarDays, ChevronRight, CircleAlert, Dumbbell, LoaderCircle } from "lucide-react";
import { api, ApiError, type CareNotification, type CareSession, type ExerciseAssignment, type PatientProfile } from "@/lib/api";
import { formatScore } from "@/lib/score";
import { CameraRecorder } from "@/components/patient/camera-recorder";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const WEEKDAY_LABELS: Record<number, string> = {
  1: "Monday", 2: "Tuesday", 3: "Wednesday", 4: "Thursday",
  5: "Friday", 6: "Saturday", 7: "Sunday",
};

function getTodayNumber() {
  const day = new Date().getDay();
  return day === 0 ? 7 : day;
}

function isPlannedToday(assignment: ExerciseAssignment, today: number) {
  if (assignment.adherence?.today) return true;
  if (assignment.scheduledDays?.length) return assignment.scheduledDays.includes(today);
  return true;
}

function getRemaining(assignment: ExerciseAssignment) {
  const period = assignment.adherence?.today ?? assignment.adherence?.currentWeek;
  return period?.remaining ?? 1;
}

function getPrescription(assignment: ExerciseAssignment) {
  return [
    assignment.targetSets ? `${assignment.targetSets} sets` : "",
    assignment.targetRepsPerSet ? `${assignment.targetRepsPerSet} reps each` : "",
    assignment.targetDurationSeconds ? `${assignment.targetDurationSeconds} seconds` : "",
  ].filter(Boolean);
}

function formatNotificationTime(value: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
  }).format(new Date(value));
}

function ExerciseVisual({ assignment }: { assignment: ExerciseAssignment | null }) {
  const image = assignment?.exercise?.images?.[0];

  return (
    <div className="patient-exercise-visual" aria-hidden={!image}>
      {image ? (
        // Exercise images can be served by the API or an administrator-provided URL.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={image.filepath}
          alt={image.imageName || `${assignment?.exercise?.name || "Exercise"} guide`}
          onError={(event) => { event.currentTarget.style.display = "none"; }}
        />
      ) : null}
      <div className="patient-exercise-placeholder">
        <span><Dumbbell /></span>
        <strong>{assignment ? "Exercise guide" : "Care plan"}</strong>
      </div>
    </div>
  );
}

export default function PatientDashboardPage() {
  const [profile, setProfile] = useState<PatientProfile | null>(null);
  const [assignments, setAssignments] = useState<ExerciseAssignment[]>([]);
  const [notifications, setNotifications] = useState<CareNotification[]>([]);
  const [sessions, setSessions] = useState<CareSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;

    async function loadDashboard() {
      try {
        const [profileRes, assignedRes, notificationsRes, sessionsRes] = await Promise.all([
          api.getProfile(),
          api.getMyAssignedExercises(),
          api.getMyNotifications().catch(() => ({ notifications: [] })),
          api.getMySessions().catch(() => ({ sessions: [] })),
        ]);

        if (mounted) {
          setProfile((profileRes.user.profile as PatientProfile) ?? null);
          setAssignments(assignedRes.assignments);
          setNotifications(notificationsRes.notifications);
          setSessions(sessionsRes.sessions);
        }
      } catch (err) {
        if (mounted) setError(err instanceof ApiError ? err.message : "Failed to load dashboard.");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadDashboard();
    return () => { mounted = false; };
  }, []);

  const dashboard = useMemo(() => {
    const todayNumber = getTodayNumber();
    const plannedToday = assignments.filter((assignment) => isPlannedToday(assignment, todayNumber));
    const nextAssignment =
      plannedToday.find((assignment) => getRemaining(assignment) > 0) ??
      assignments.find((assignment) => getRemaining(assignment) > 0) ??
      plannedToday[0] ?? assignments[0] ?? null;
    const todayComplete = plannedToday.length > 0 && plannedToday.every((assignment) => getRemaining(assignment) === 0);
    const isRestDay = assignments.length > 0 && plannedToday.length === 0;
    const weeklyCompleted = assignments.reduce(
      (sum, assignment) => sum + (assignment.adherence?.currentWeek.completed ?? 0), 0,
    );
    const weeklyTarget = assignments.reduce(
      (sum, assignment) => sum + (assignment.adherence?.currentWeek.target ?? assignment.targetSessionsPerWeek ?? 0), 0,
    );
    const weeklyPercentage = weeklyTarget > 0
      ? Math.min(100, Math.round((weeklyCompleted / weeklyTarget) * 100)) : 0;
    const latestSession = [...sessions].sort(
      (left, right) => new Date(right.performedAt).getTime() - new Date(left.performedAt).getTime(),
    )[0];
    const unreadNotifications = notifications.filter((notification) => !notification.isRead);

    return {
      todayNumber, nextAssignment, todayComplete, isRestDay, weeklyCompleted,
      weeklyTarget, weeklyPercentage, latestSession, unreadNotifications,
    };
  }, [assignments, notifications, sessions]);

  if (loading) {
    return (
      <div className="patient-dashboard-loading" role="status" aria-label="Loading your dashboard">
        <LoaderCircle className="recorder-spin" />
        <span>Loading your care plan…</span>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="patient-dashboard-error" role="alert">
        <CardContent className="patient-dashboard-error-content">
          <CircleAlert aria-hidden="true" />
          <div>
            <CardTitle>We could not load your dashboard</CardTitle>
            <CardDescription>{error}</CardDescription>
          </div>
          <Button onClick={() => window.location.reload()}>Try again</Button>
        </CardContent>
      </Card>
    );
  }

  const firstName = profile?.firstName?.trim();
  const prescription = dashboard.nextAssignment ? getPrescription(dashboard.nextAssignment) : [];
  const primaryPeriod = dashboard.nextAssignment?.adherence?.today ?? dashboard.nextAssignment?.adherence?.currentWeek;
  const latestUpdate = dashboard.unreadNotifications[0] ?? notifications[0];

  return (
    <div className="patient-dashboard animate-fade-in">
      <header className="patient-dashboard-header">
        <div>
          <span className="patient-dashboard-day">{WEEKDAY_LABELS[dashboard.todayNumber]}</span>
          <h1>Hello{firstName ? `, ${firstName}` : ""}</h1>
          <p>Here is the one thing to focus on next.</p>
        </div>
        <Button variant="outline" className="patient-dashboard-all-link" nativeButton={false} render={<Link href="/patient/exercises" />}>
          All exercises
          <ChevronRight aria-hidden="true" />
        </Button>
      </header>

      <Card className="patient-next-card">
        <CardContent className="patient-next-content">
          <ExerciseVisual assignment={dashboard.nextAssignment} />

          {assignments.length === 0 ? (
            <div className="patient-next-copy">
              <span className="patient-next-label">Your care plan</span>
              <h2>No exercises assigned yet</h2>
              <p>Your doctor will add exercises here when your plan is ready.</p>
            </div>
          ) : dashboard.todayComplete ? (
            <div className="patient-next-copy">
              <span className="patient-next-label">Today&apos;s plan</span>
              <h2>You&apos;re finished for today</h2>
              <p>Great work. Rest and come back for your next scheduled session.</p>
              <Button variant="outline" nativeButton={false} render={<Link href="/patient/exercises" />}>Review my exercises</Button>
            </div>
          ) : dashboard.isRestDay ? (
            <div className="patient-next-copy">
              <span className="patient-next-label">Today&apos;s plan</span>
              <h2>Today is a rest day</h2>
              <p>No exercise is scheduled today. Your next sessions are available on the exercises page.</p>
              <Button variant="outline" nativeButton={false} render={<Link href="/patient/exercises" />}>See my schedule</Button>
            </div>
          ) : dashboard.nextAssignment ? (
            <div className="patient-next-copy">
              <span className="patient-next-label">Do this next</span>
              <h2>{dashboard.nextAssignment.exercise?.name || "Exercise"}</h2>
              <p>{dashboard.nextAssignment.exercise?.description || "Follow the movement your doctor assigned."}</p>

              {prescription.length > 0 && (
                <div className="patient-prescription" aria-label="Exercise instructions">
                  {prescription.map((item) => <span key={item}>{item}</span>)}
                </div>
              )}

              {dashboard.nextAssignment.doctorInstructions && (
                <div className="patient-doctor-note">
                  <strong>Your doctor says:</strong> {dashboard.nextAssignment.doctorInstructions}
                </div>
              )}

              {primaryPeriod && (
                <div className="patient-next-progress">
                  <span>
                    {primaryPeriod.remaining > 0
                      ? `${primaryPeriod.remaining} session${primaryPeriod.remaining === 1 ? "" : "s"} left ${dashboard.nextAssignment.adherence?.today ? "today" : "this week"}`
                      : "Goal complete"}
                  </span>
                  <div role="progressbar" aria-label="Exercise sessions complete" aria-valuemin={0} aria-valuemax={100} aria-valuenow={primaryPeriod.target ? Math.min(100, Math.round((primaryPeriod.completed / primaryPeriod.target) * 100)) : 0} aria-valuetext={`${primaryPeriod.completed} of ${primaryPeriod.target} sessions complete`}>
                    <i style={{ width: `${primaryPeriod.target ? Math.min(100, (primaryPeriod.completed / primaryPeriod.target) * 100) : 0}%` }} />
                  </div>
                </div>
              )}

              <div className="patient-dashboard-primary-action">
                <CameraRecorder
                  exerciseName={dashboard.nextAssignment.exercise?.name}
                  analysisModelKey={dashboard.nextAssignment.exercise?.analysisModelKey}
                  exerciseId={dashboard.nextAssignment.exercise?.id}
                  assignmentId={dashboard.nextAssignment.id}
                  targetDurationSeconds={dashboard.nextAssignment.targetDurationSeconds}
                  minimumDurationSeconds={dashboard.nextAssignment.minimumDurationSeconds}
                />
                <span>The camera only turns on after you click.</span>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <div className="patient-dashboard-summary-grid">
        <Card className="patient-summary-card">
          <CardHeader>
            <div className="patient-summary-heading">
              <span className="patient-summary-icon"><CalendarDays aria-hidden="true" /></span>
              <div>
                <CardTitle>Your week</CardTitle>
                <CardDescription>A simple view of your progress</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="patient-week-number">
              <strong>{dashboard.weeklyCompleted}</strong>
              <span>of {dashboard.weeklyTarget || "—"} sessions done</span>
            </div>
            <div className="patient-week-progress" role="progressbar" aria-label="Weekly goal complete" aria-valuemin={0} aria-valuemax={100} aria-valuenow={dashboard.weeklyPercentage}>
              <span style={{ width: `${dashboard.weeklyPercentage}%` }} />
            </div>
            <div className="patient-week-footer">
              <span>{dashboard.weeklyPercentage}% complete</span>
              <span>{dashboard.latestSession?.score != null ? `Latest score: ${formatScore(dashboard.latestSession.score)}` : "No score yet"}</span>
            </div>
          </CardContent>
        </Card>

        <Card className="patient-summary-card">
          <CardHeader>
            <div className="patient-summary-heading">
              <span className="patient-summary-icon"><Bell aria-hidden="true" /></span>
              <div>
                <CardTitle>Updates</CardTitle>
                <CardDescription>
                  {dashboard.unreadNotifications.length > 0 ? `${dashboard.unreadNotifications.length} new for you` : "You are all caught up"}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="patient-update-content">
            {latestUpdate ? (
              <div className="patient-latest-update">
                <strong>{latestUpdate.title}</strong>
                <p>{latestUpdate.body}</p>
                <span>{formatNotificationTime(latestUpdate.createdAt)}</span>
              </div>
            ) : (
              <p className="patient-no-update">Messages and reminders from your care team will appear here.</p>
            )}
            <Button variant="ghost" nativeButton={false} render={<Link href="/patient/notifications" />}>
              View updates
              <ChevronRight aria-hidden="true" />
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
