"use client";

import { useEffect, useMemo, useState } from "react";
import { api, ApiError, type CareNotification, type CareSession, type ExerciseAssignment } from "@/lib/api";
import { MyExerciseList } from "@/components/patient/my-exercise-list";
import { CareTimeline } from "@/components/care/care-timeline";
import { NotificationsPanel } from "@/components/care/notifications-panel";
import { ChatPanel } from "@/components/care/chat-panel";
import { ScoreSummary } from "@/components/care/score-summary";

export default function PatientExercisesPage() {
  const [assignments, setAssignments] = useState<ExerciseAssignment[]>([]);
  const [sessions, setSessions] = useState<CareSession[]>([]);
  const [notifications, setNotifications] = useState<CareNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    let mounted = true;

    async function loadExercises() {
      try {
        const [assignedRes, sessionsRes, notificationsRes] = await Promise.all([
          api.getMyAssignedExercises(),
          api.getMySessions(),
          api.getMyNotifications(),
        ]);
        if (mounted) {
          setAssignments(assignedRes.assignments);
          void api.markExercisesViewed(assignedRes.assignments.map((assignment) => assignment.id)).catch(() => undefined);
          setSessions(sessionsRes.sessions);
          setNotifications(notificationsRes.notifications);
        }
      } catch (err) {
        if (mounted) setError(err instanceof ApiError ? err.message : "Failed to load assigned exercises.");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadExercises();
    return () => {
      mounted = false;
    };
  }, []);

  const filteredAssignments = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return assignments;
    return assignments.filter((assignment) => {
      return (
        assignment.exercise?.name?.toLowerCase().includes(query) ||
        assignment.exercise?.description?.toLowerCase().includes(query)
      );
    });
  }, [assignments, searchTerm]);

  return (
    <div className="animate-fade-in" style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      <div>
        <h1 style={{ fontSize: "28px", fontWeight: 700, margin: "0 0 8px 0" }}>My Exercises</h1>
        <p style={{ color: "var(--color-text-secondary)", margin: 0 }}>
          View rehabilitation exercises assigned by your doctor.
        </p>
      </div>

      <div className="card" style={{ padding: "20px" }}>
        <div className="doctor-toolbar" style={{ marginBottom: "20px" }}>
          <input
            className="input"
            type="text"
            placeholder="Search exercises"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            style={{ maxWidth: "340px" }}
          />
        </div>

        {error && (
          <div style={{ padding: "14px 16px", backgroundColor: "#FEF2F2", color: "var(--color-danger)", borderRadius: "var(--radius-md)" }}>
            {error}
          </div>
        )}

        {loading ? (
          <div style={{ display: "flex", justifyContent: "center", padding: "48px" }}><div className="spinner" /></div>
        ) : (
          <MyExerciseList assignments={filteredAssignments}/>
        )}
      </div>

      <section className="doctor-two-column">
        <div className="card" style={{ padding: "24px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "center", marginBottom: "18px", flexWrap: "wrap" }}>
            <h2 style={{ fontSize: "18px", fontWeight: 600, margin: 0 }}>Care Timeline</h2>
            <span style={{ color: "var(--color-text-muted)", fontSize: "13px" }}>{sessions.length} session{sessions.length === 1 ? "" : "s"}</span>
          </div>
          <CareTimeline sessions={sessions} role="patient" />
        </div>

        <div className="card" style={{ padding: "24px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "center", marginBottom: "18px", flexWrap: "wrap" }}>
            <h2 style={{ fontSize: "18px", fontWeight: 600, margin: 0 }}>Notifications</h2>
            <span style={{ color: "var(--color-text-muted)", fontSize: "13px" }}>{notifications.filter((notification) => !notification.isRead).length} unread</span>
          </div>
          <NotificationsPanel notifications={notifications.slice(0, 5)} />
        </div>
      </section>

      <ScoreSummary sessions={sessions} />

      <ChatPanel role="patient" counterpartName="your doctor" />
    </div>
  );
}
