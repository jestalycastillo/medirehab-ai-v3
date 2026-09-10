"use client";

import { useEffect, useMemo, useState } from "react";
import { api, type ApiDoctor, type ApiExercise, type ApiPatient, type AuditLog, type CareSession, ApiError } from "@/lib/api";
import { StatCard } from "@/components/ui/stat-card";
import { StatusBadge } from "@/components/ui/status-badge";
import Link from "next/link";

function UsersIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function UserCheckIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <polyline points="16 11 18 13 22 9" />
    </svg>
  );
}

function ActivityIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  );
}

function ArrowRightIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14" />
      <path d="m12 5 7 7-7 7" />
    </svg>
  );
}

function getLocalDateKey(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatShortDate(date: Date) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(date);
}

function buildTrendPoints(sessions: CareSession[], days = 7) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const counts = new Map<string, number>();
  for (const session of sessions) {
    const performed = new Date(session.performedAt);
    const key = getLocalDateKey(performed);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return Array.from({ length: days }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() - (days - 1 - index));
    const dateKey = getLocalDateKey(date);
    return {
      label: formatShortDate(date),
      dateKey,
      value: counts.get(dateKey) ?? 0,
    };
  });
}

function buildDoctorLoad(doctors: ApiDoctor[], patients: ApiPatient[]) {
  const counts = new Map<string, number>();

  for (const patient of patients) {
    if (patient.archivedAt) continue;
    const doctorId = patient.profile?.assignedDoctor?.user?.id;
    if (!doctorId) continue;
    counts.set(doctorId, (counts.get(doctorId) ?? 0) + 1);
  }

  return doctors
    .map((doctor) => ({ doctor, count: counts.get(doctor.id) ?? 0 }))
    .filter((item) => !item.doctor.archivedAt || item.count > 0)
    .sort((a, b) => b.count - a.count || a.doctor.email.localeCompare(b.doctor.email))
    .slice(0, 6);
}

function TrendChart({ points }: { points: { label: string; value: number }[] }) {
  const width = 700;
  const height = 220;
  const padding = { top: 24, right: 20, bottom: 42, left: 20 };
  const innerWidth = width - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;
  const maxValue = Math.max(1, ...points.map((point) => point.value));

  const stepX = points.length > 1 ? innerWidth / (points.length - 1) : 0;
  const coords = points.map((point, index) => {
    const x = padding.left + index * stepX;
    const y = padding.top + innerHeight - (point.value / maxValue) * innerHeight;
    return { x, y, ...point };
  });

  const polyline = coords.map((point) => `${point.x},${point.y}`).join(" ");

  return (
    <div style={{ width: "100%" }}>
      <svg viewBox={`0 0 ${width} ${height}`} width="100%" height="220" role="img" aria-label="Care activity trend chart">
        {[0, 0.25, 0.5, 0.75, 1].map((tick) => {
          const y = padding.top + innerHeight - tick * innerHeight;
          return <line key={tick} x1={padding.left} x2={width - padding.right} y1={y} y2={y} stroke="var(--color-border)" strokeDasharray="4 4" />;
        })}

        <polyline
          points={polyline}
          fill="none"
          stroke="var(--color-primary)"
          strokeWidth="3"
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {coords.map((point, index) => (
          <g key={`${point.label}-${index}`}>
            <circle cx={point.x} cy={point.y} r="5" fill="var(--color-primary)" />
            <circle cx={point.x} cy={point.y} r="9" fill="var(--color-primary)" opacity="0.12" />
            <text x={point.x} y={height - 16} textAnchor="middle" fill="var(--color-text-muted)" fontSize="11">
              {point.label}
            </text>
            <text x={point.x} y={point.y - 12} textAnchor="middle" fill="var(--color-text-primary)" fontSize="12" fontWeight="600">
              {point.value}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

function DoctorLoadBars({ items }: { items: { doctor: ApiDoctor; count: number }[] }) {
  const maxCount = Math.max(1, ...items.map((item) => item.count));

  if (items.length === 0) {
    return (
      <p style={{ padding: "24px", textAlign: "center", color: "var(--color-text-muted)", margin: 0 }}>
        No doctor assignments yet.
      </p>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
      {items.map((item) => (
        <div key={item.doctor.id} style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "baseline" }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 600, color: "var(--color-text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {item.doctor.profile ? `Dr. ${item.doctor.profile.firstName} ${item.doctor.profile.lastName}` : item.doctor.email}
              </div>
              <div style={{ color: "var(--color-text-muted)", fontSize: "12px" }}>
                {item.count} active patient{item.count === 1 ? "" : "s"}
              </div>
            </div>
            <StatusBadge isActive={item.doctor.isActive} archivedAt={item.doctor.archivedAt} />
          </div>
          <div style={{ height: "10px", background: "var(--color-page-bg)", borderRadius: "999px", overflow: "hidden" }}>
            <div
              style={{
                width: `${(item.count / maxCount) * 100}%`,
                height: "100%",
                background: "linear-gradient(90deg, var(--color-primary), #5ca0ff)",
                borderRadius: "999px",
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
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
          api.getDoctors(),
          api.getAdminPatients(),
          api.getExercises(),
          api.getAdminCareSessions(),
          api.getAuditLogs(),
        ]);
        if (mounted) {
          setDoctors(docsRes.doctors);
          setPatients(patientsRes.patients);
          setExercises(exRes.exercises);
          setSessions(sessionsRes.sessions);
          setAuditLogs(auditRes.logs);
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof ApiError ? err.message : "Failed to load dashboard data");
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    loadData();
    return () => {
      mounted = false;
    };
  }, []);

  const activeDoctors = doctors.filter((doctor) => doctor.isActive && !doctor.archivedAt).length;
  const totalPatients = patients.length;

  const recentDoctors = [...doctors].reverse().slice(0, 5);
  const recentExercises = [...exercises].reverse().slice(0, 5);

  const careTrend = useMemo(() => buildTrendPoints(sessions, 7), [sessions]);
  const doctorLoad = useMemo(() => buildDoctorLoad(doctors, patients), [doctors, patients]);

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "400px" }}>
        <div className="spinner"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card" style={{ padding: "24px", borderColor: "var(--color-danger)", backgroundColor: "#FEF2F2" }}>
        <h3 style={{ color: "var(--color-danger)", margin: "0 0 8px 0" }}>Error loading dashboard</h3>
        <p style={{ color: "var(--color-text-secondary)", margin: 0 }}>{error}</p>
      </div>
    );
  }

  return (
    <div className="animate-fade-in" style={{ display: "flex", flexDirection: "column", gap: "32px" }}>
      <div>
        <h1 style={{ fontSize: "28px", fontWeight: 700, margin: "0 0 8px 0", color: "var(--color-text-primary)" }}>
          Dashboard Overview
        </h1>
        <p style={{ fontSize: "15px", color: "var(--color-text-secondary)", margin: 0 }}>
          Manage your platform&apos;s doctors, patients, and exercise catalog.
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "20px" }}>
        <StatCard title="Total Doctors" value={doctors.length} icon={<UsersIcon />} />
        <StatCard title="Active Doctors" value={activeDoctors} icon={<UserCheckIcon />} />
        <StatCard title="Total Patients" value={totalPatients} icon={<UsersIcon />} />
        <StatCard title="Total Exercises" value={exercises.length} icon={<ActivityIcon />} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(420px, 1fr))", gap: "24px" }}>
        <div className="card" style={{ display: "flex", flexDirection: "column", padding: "20px 24px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "16px", marginBottom: "18px" }}>
            <div>
              <h2 style={{ fontSize: "16px", fontWeight: 600, margin: 0 }}>Care Activity Trend</h2>
              <p style={{ margin: "6px 0 0 0", fontSize: "13px", color: "var(--color-text-muted)" }}>
                Exercise sessions completed over the last 7 days.
              </p>
            </div>
            <Link href="/admin/patients" style={{ fontSize: "14px", color: "var(--color-primary)", textDecoration: "none", fontWeight: 500, display: "flex", alignItems: "center", gap: "4px" }}>
              View patients <ArrowRightIcon />
            </Link>
          </div>
          <TrendChart points={careTrend} />
        </div>

        <div className="card" style={{ display: "flex", flexDirection: "column", padding: "20px 24px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "16px", marginBottom: "18px" }}>
            <div>
              <h2 style={{ fontSize: "16px", fontWeight: 600, margin: 0 }}>Patient Load by Doctor</h2>
              <p style={{ margin: "6px 0 0 0", fontSize: "13px", color: "var(--color-text-muted)" }}>
                Active patients assigned to each doctor.
              </p>
            </div>
            <Link href="/admin/doctors" style={{ fontSize: "14px", color: "var(--color-primary)", textDecoration: "none", fontWeight: 500, display: "flex", alignItems: "center", gap: "4px" }}>
              View doctors <ArrowRightIcon />
            </Link>
          </div>
          <DoctorLoadBars items={doctorLoad} />
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(400px, 1fr))", gap: "24px" }}>
        <div className="card" style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--color-border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h2 style={{ fontSize: "16px", fontWeight: 600, margin: 0 }}>Recent Doctors</h2>
            <Link href="/admin/doctors" style={{ fontSize: "14px", color: "var(--color-primary)", textDecoration: "none", fontWeight: 500, display: "flex", alignItems: "center", gap: "4px" }}>
              View all <ArrowRightIcon />
            </Link>
          </div>
          <div style={{ padding: "12px 0" }}>
            {recentDoctors.length === 0 ? (
              <p style={{ padding: "24px", textAlign: "center", color: "var(--color-text-muted)", margin: 0 }}>No doctors found.</p>
            ) : (
              <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                {recentDoctors.map((doctor) => (
                  <li key={doctor.id} style={{ padding: "12px 24px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--color-page-bg)" }}>
                    <div>
                      <div style={{ fontWeight: 500, color: "var(--color-text-primary)" }}>
                        {doctor.profile ? `Dr. ${doctor.profile.firstName} ${doctor.profile.lastName}` : "Unknown"}
                      </div>
                      <div style={{ fontSize: "13px", color: "var(--color-text-muted)" }}>{doctor.email}</div>
                    </div>
                    <StatusBadge isActive={doctor.isActive} archivedAt={doctor.archivedAt} />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="card" style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--color-border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h2 style={{ fontSize: "16px", fontWeight: 600, margin: 0 }}>Recent Exercises</h2>
            <Link href="/admin/exercises" style={{ fontSize: "14px", color: "var(--color-primary)", textDecoration: "none", fontWeight: 500, display: "flex", alignItems: "center", gap: "4px" }}>
              View all <ArrowRightIcon />
            </Link>
          </div>
          <div style={{ padding: "12px 0" }}>
            {recentExercises.length === 0 ? (
              <p style={{ padding: "24px", textAlign: "center", color: "var(--color-text-muted)", margin: 0 }}>No exercises found.</p>
            ) : (
              <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                {recentExercises.map((exercise) => (
                  <li key={exercise.id} style={{ padding: "12px 24px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--color-page-bg)" }}>
                    <div style={{ fontWeight: 500, color: "var(--color-text-primary)" }}>
                      {exercise.name || exercise.id}
                    </div>
                    <StatusBadge isActive={!exercise.archivedAt} archivedAt={exercise.archivedAt} />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      <section className="card" style={{ padding: "24px" }}><h2 style={{ fontSize: "16px", fontWeight: 600, margin: "0 0 14px" }}>Recent Audit Activity</h2>{auditLogs.length === 0 ? <p style={{ color: "var(--color-text-muted)" }}>No recorded changes yet.</p> : <div style={{ overflowX: "auto" }}><table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}><thead><tr><th style={{ textAlign: "left", padding: "8px" }}>User</th><th style={{ textAlign: "left", padding: "8px" }}>Action</th><th style={{ textAlign: "left", padding: "8px" }}>Status</th><th style={{ textAlign: "left", padding: "8px" }}>Time</th></tr></thead><tbody>{auditLogs.slice(0, 20).map((log) => <tr key={log.id} style={{ borderTop: "1px solid var(--color-border)" }}><td style={{ padding: "8px" }}>{log.actor?.email ?? "Deleted user"}</td><td style={{ padding: "8px" }}>{log.method} {log.path}</td><td style={{ padding: "8px" }}>{log.statusCode}</td><td style={{ padding: "8px" }}>{new Date(log.createdAt).toLocaleString()}</td></tr>)}</tbody></table></div>}</section>
    </div>
  );
}
