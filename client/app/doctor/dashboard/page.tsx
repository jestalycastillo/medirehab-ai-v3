"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api, ApiError, type ApiPatient, type CareNotification, type DoctorProfile, type ExerciseAssignment } from "@/lib/api";
import { StatCard } from "@/components/ui/stat-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { NotificationsPanel } from "@/components/care/notifications-panel";

function UsersIcon() {
  return <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /></svg>;
}

function ActivityIcon() {
  return <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>;
}

function patientName(patient: ApiPatient) {
  return [patient.profile?.firstName, patient.profile?.lastName].filter(Boolean).join(" ") || "Unnamed patient";
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
          })
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
        <h2 style={{ margin: "0 0 8px 0", color: "var(--color-danger)", fontSize: "18px" }}>Error loading dashboard</h2>
        <p style={{ margin: 0, color: "var(--color-text-secondary)" }}>{error}</p>
      </div>
    );
  }

  const activePatients = patients.filter((patient) => patient.isActive && !patient.archivedAt).length;
  const inactivePatients = patients.length - activePatients;
  const assignmentTotal = Object.values(assignmentsByPatient).reduce((sum, assignments) => sum + assignments.length, 0);
  const recentPatients = patients.slice(0, 5);
  const doctorName = [profile?.firstName, profile?.lastName].filter(Boolean).join(" ");

  return (
    <div className="animate-fade-in" style={{ display: "flex", flexDirection: "column", gap: "28px" }}>
      <section className="card" style={{ padding: "28px", display: "flex", justifyContent: "space-between", gap: "20px", alignItems: "center", flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: "28px", fontWeight: 700, margin: "0 0 8px 0" }}>
            Welcome{doctorName ? `, Dr. ${doctorName}` : ""}
          </h1>
          <p style={{ fontSize: "15px", color: "var(--color-text-secondary)", margin: 0 }}>
            Manage assigned patients and rehabilitation exercise plans.
          </p>
        </div>
        <div className="responsive-actions">
          <Link href="/doctor/patients" className="btn btn-primary">Create Patient</Link>
          <Link href="/doctor/exercise-assignments" className="btn btn-secondary">Assign Exercise</Link>
        </div>
      </section>

      <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "20px" }}>
        <StatCard title="Total Patients" value={patients.length} icon={<UsersIcon />} />
        <StatCard title="Active Patients" value={activePatients} icon={<UsersIcon />} />
        <StatCard title="Inactive/Archived" value={inactivePatients} icon={<UsersIcon />} />
        <StatCard title="Assigned Exercises" value={assignmentTotal} icon={<ActivityIcon />} />
      </section>

      <section className="doctor-two-column">
        <div className="card" style={{ overflow: "hidden" }}>
          <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--color-border)", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px" }}>
            <h2 style={{ fontSize: "18px", fontWeight: 600, margin: 0 }}>Recent Patients</h2>
            <Link href="/doctor/patients" style={{ color: "var(--color-primary)", textDecoration: "none", fontWeight: 600, fontSize: "14px" }}>View all</Link>
          </div>
          {recentPatients.length === 0 ? (
            <div style={{ padding: "32px 24px", textAlign: "center", color: "var(--color-text-muted)" }}>No patients assigned yet.</div>
          ) : (
            <div>
              {recentPatients.map((patient) => (
                <div key={patient.id} style={{ padding: "16px 24px", borderBottom: "1px solid var(--color-page-bg)", display: "flex", justifyContent: "space-between", gap: "16px", alignItems: "center", flexWrap: "wrap" }}>
                  <div>
                    <Link href={`/doctor/patients/${patient.id}`} style={{ color: "var(--color-text-primary)", fontWeight: 600, textDecoration: "none" }}>
                      {patientName(patient)}
                    </Link>
                    <div style={{ color: "var(--color-text-muted)", fontSize: "13px" }}>{patient.email}</div>
                  </div>
                  <StatusBadge isActive={patient.isActive} archivedAt={patient.archivedAt} />
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card" style={{ padding: "24px" }}>
          <h2 style={{ fontSize: "18px", fontWeight: 600, margin: "0 0 16px 0" }}>Quick Actions</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <Link className="btn btn-primary btn-full" href="/doctor/patients">Create patient account</Link>
            <Link className="btn btn-secondary btn-full" href="/doctor/exercise-assignments">Assign rehabilitation exercise</Link>
            <Link className="btn btn-secondary btn-full" href="/doctor/profile">Update profile</Link>
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
