"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api, ApiError, type CareNotification, type ExerciseAssignment, type PatientProfile } from "@/lib/api";
import { StatCard } from "@/components/ui/stat-card";
import { MyExerciseList } from "@/components/patient/my-exercise-list";
import { NotificationsPanel } from "@/components/care/notifications-panel";

function ActivityIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21a8 8 0 0 0-16 0" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

export default function PatientDashboardPage() {
  const [profile, setProfile] = useState<PatientProfile | null>(null);
  const [assignments, setAssignments] = useState<ExerciseAssignment[]>([]);
  const [notifications, setNotifications] = useState<CareNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;

    async function loadDashboard() {
      try {
        const [profileRes, assignedRes, notificationsRes] = await Promise.all([
          api.getProfile(),
          api.getMyAssignedExercises(),
          api.getMyNotifications().catch(() => ({ notifications: [] })),
        ]);

        if (mounted) {
          setProfile((profileRes.user.profile as PatientProfile) ?? null);
          setAssignments(assignedRes.assignments);
          setNotifications(notificationsRes.notifications);
        }
      } catch (err) {
        if (mounted) setError(err instanceof ApiError ? err.message : "Failed to load dashboard.");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadDashboard();
    return () => {
      mounted = false;
    };
  }, []);

  if (loading) {
    return <div style={{ display: "flex", justifyContent: "center", padding: "80px" }}><div className="spinner" /></div>;
  }

  if (error) {
    return (
      <div className="card" style={{ padding: "24px", borderColor: "var(--color-danger)", backgroundColor: "#FEF2F2" }}>
        <h1 style={{ color: "var(--color-danger)", fontSize: "20px", margin: "0 0 8px 0" }}>Unable to load dashboard</h1>
        <p style={{ margin: 0, color: "var(--color-text-secondary)" }}>{error}</p>
      </div>
    );
  }

  const patientName = [profile?.firstName, profile?.lastName].filter(Boolean).join(" ");
  const latestScore = assignments[0]?.result?.score ?? 0;

  return (
    <div className="animate-fade-in" style={{ display: "flex", flexDirection: "column", gap: "28px" }}>
      <section className="card" style={{ padding: "28px", display: "flex", justifyContent: "space-between", gap: "20px", alignItems: "center", flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: "28px", fontWeight: 700, margin: "0 0 8px 0" }}>
            Welcome{patientName ? `, ${patientName}` : ""}
          </h1>
          <p style={{ color: "var(--color-text-secondary)", margin: 0 }}>
            Review your assigned rehabilitation exercises and recovery profile.
          </p>
        </div>
        <div className="responsive-actions">
          <Link className="btn btn-primary" href="/patient/exercises">View Exercises</Link>
          <Link className="btn btn-secondary" href="/patient/profile">Update Profile</Link>
        </div>
      </section>

      <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "20px" }}>
        <StatCard title="Assigned Exercises" value={assignments.length} icon={<ActivityIcon />} />
        <StatCard title="Latest Score" value={latestScore} icon={<ActivityIcon />} />
        <StatCard title="Profile Status" value={profile?.medicalCondition ? "Updated" : "Incomplete"} icon={<UserIcon />} />
      </section>

      <section className="doctor-two-column">
        <div className="card" style={{ padding: "24px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", marginBottom: "18px" }}>
            <h2 style={{ fontSize: "18px", fontWeight: 600, margin: 0 }}>Recent Exercises</h2>
            <Link href="/patient/exercises" style={{ color: "var(--color-primary)", textDecoration: "none", fontWeight: 600, fontSize: "14px" }}>
              View all
            </Link>
          </div>
          <MyExerciseList assignments={assignments.slice(0, 3)} compact />
        </div>

        <div className="card" style={{ padding: "24px" }}>
          <h2 style={{ fontSize: "18px", fontWeight: 600, margin: "0 0 18px 0" }}>Care Profile</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <div>
              <div style={{ fontSize: "12px", fontWeight: 700, color: "var(--color-text-muted)", textTransform: "uppercase" }}>Medical Condition</div>
              <div style={{ fontWeight: 600, marginTop: "4px" }}>{profile?.medicalCondition || "-"}</div>
            </div>
            <div>
              <div style={{ fontSize: "12px", fontWeight: 700, color: "var(--color-text-muted)", textTransform: "uppercase" }}>Contact Number</div>
              <div style={{ fontWeight: 600, marginTop: "4px" }}>{profile?.contactNumber || "-"}</div>
            </div>
            <div>
              <div style={{ fontSize: "12px", fontWeight: 700, color: "var(--color-text-muted)", textTransform: "uppercase" }}>Address</div>
              <div style={{ fontWeight: 600, marginTop: "4px" }}>{profile?.address || "-"}</div>
            </div>
          </div>
        </div>
      </section>

      <section className="card" style={{ padding: "24px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "center", marginBottom: "18px", flexWrap: "wrap" }}>
          <h2 style={{ fontSize: "18px", fontWeight: 600, margin: 0 }}>Notifications</h2>
          <span style={{ color: "var(--color-text-muted)", fontSize: "13px" }}>{notifications.filter((notification) => !notification.isRead).length} unread</span>
        </div>
        <NotificationsPanel notifications={notifications.slice(0, 4)} />
      </section>
    </div>
  );
}
