"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { api, ApiError, type ApiPatient, type CareSession, type ExerciseAssignment, type PatientProfile } from "@/lib/api";
import { StatusBadge } from "@/components/ui/status-badge";
import { StatCard } from "@/components/ui/stat-card";
import { PatientForm } from "@/components/doctor/patient-form";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { TemporaryPasswordDialog } from "@/components/ui/temporary-password-dialog";
import { CareTimeline } from "@/components/care/care-timeline";
import { ChatPanel } from "@/components/care/chat-panel";

function ActivityIcon() {
  return <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>;
}

function buildGeneratedPassword() {
  return `Temp${Math.random().toString(36).slice(2, 8)}!9A`;
}

function patientName(patient?: ApiPatient) {
  if (!patient) return "Patient";
  return [patient.profile?.firstName, patient.profile?.lastName].filter(Boolean).join(" ") || patient.email;
}

function DetailField({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <div style={{ fontSize: "12px", fontWeight: 700, textTransform: "uppercase", color: "var(--color-text-muted)", marginBottom: "4px" }}>{label}</div>
      <div style={{ color: "var(--color-text-primary)", fontWeight: 500 }}>{value || "-"}</div>
    </div>
  );
}

function formatTimestamp(value?: string | null) {
  if (!value) return "Never";
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value));
}

export default function PatientDetailPage() {
  const params = useParams<{ patientUserId: string }>();
  const router = useRouter();
  const patientUserId = params.patientUserId;
  const [patient, setPatient] = useState<ApiPatient | null>(null);
  const [assignments, setAssignments] = useState<ExerciseAssignment[]>([]);
  const [sessions, setSessions] = useState<CareSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [commentLoading, setCommentLoading] = useState(false);
  const [temporaryPassword, setTemporaryPassword] = useState("");
  const [isTemporaryPasswordOpen, setIsTemporaryPasswordOpen] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState({
    isOpen: false,
    title: "",
    message: "",
    confirmLabel: "Confirm",
    isDestructive: false,
    isLoading: false,
    action: async () => {},
  });

  const loadPatient = async () => {
    setLoading(true);
    setError("");
    try {
      const [patientRes, assignmentsRes, sessionsRes] = await Promise.all([
        api.getPatient(patientUserId),
        api.getAssignedExercises(patientUserId),
        api.getPatientSessions(patientUserId),
      ]);
      setPatient(patientRes.patient);
      setAssignments(assignmentsRes.assignments);
      setSessions(sessionsRes.sessions);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load patient.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadPatient();
    const interval = window.setInterval(() => void loadPatient(), 30_000);
    return () => window.clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientUserId]);

  const handleSavePatient = async (data: Partial<ApiPatient & PatientProfile>) => {
    setFormLoading(true);
    try {
      await api.updatePatient(patientUserId, data);
      setIsFormOpen(false);
      await loadPatient();
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Failed to update patient.");
    } finally {
      setFormLoading(false);
    }
  };

  const handleAddComment = async (sessionId: string, body: string) => {
    setCommentLoading(true);
    try {
      await api.addDoctorComment(sessionId, body);
      await loadPatient();
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Failed to add comment.");
    } finally {
      setCommentLoading(false);
    }
  };

  const resetPassword = () => {
    if (!patient) return;
    const nextPassword = buildGeneratedPassword();
    setConfirmDialog({
      isOpen: true,
      title: "Reset Patient Password",
      message: `Reset the password for ${patientName(patient)}? A new temporary password will be shown after the reset.`,
      confirmLabel: "Reset Password",
      isDestructive: false,
      isLoading: false,
      action: async () => {
        setConfirmDialog((prev) => ({ ...prev, isLoading: true }));
        try {
          await api.resetPatientPassword(patient.id, nextPassword);
          setTemporaryPassword(nextPassword);
          setIsTemporaryPasswordOpen(true);
        } catch (err) {
          alert(err instanceof ApiError ? err.message : "Password reset failed.");
        } finally {
          setConfirmDialog((prev) => ({ ...prev, isOpen: false, isLoading: false }));
        }
      },
    });
  };

  const toggleStatus = () => {
    if (!patient) return;
    setConfirmDialog({
      isOpen: true,
      title: `${patient.isActive ? "Deactivate" : "Activate"} Patient`,
      message: `Are you sure you want to ${patient.isActive ? "deactivate" : "activate"} ${patientName(patient)}?`,
      confirmLabel: patient.isActive ? "Deactivate" : "Activate",
      isDestructive: patient.isActive,
      isLoading: false,
      action: async () => {
        setConfirmDialog((prev) => ({ ...prev, isLoading: true }));
        try {
          await api.updatePatientStatus(patient.id, !patient.isActive);
          await loadPatient();
        } catch (err) {
          alert(err instanceof ApiError ? err.message : "Operation failed.");
        } finally {
          setConfirmDialog((prev) => ({ ...prev, isOpen: false, isLoading: false }));
        }
      },
    });
  };

  const archivePatient = () => {
    if (!patient) return;
    setConfirmDialog({
      isOpen: true,
      title: "Archive Patient",
      message: `Archive ${patientName(patient)}? This removes the patient from active care lists.`,
      confirmLabel: "Archive",
      isDestructive: true,
      isLoading: false,
      action: async () => {
        setConfirmDialog((prev) => ({ ...prev, isLoading: true }));
        try {
          await api.deletePatient(patient.id);
          router.push("/doctor/patients");
        } catch (err) {
          alert(err instanceof ApiError ? err.message : "Archive failed.");
        } finally {
          setConfirmDialog((prev) => ({ ...prev, isOpen: false, isLoading: false }));
        }
      },
    });
  };

  if (loading) return <div style={{ display: "flex", justifyContent: "center", padding: "80px" }}><div className="spinner" /></div>;

  if (error || !patient) {
    return (
      <div className="card" style={{ padding: "24px", borderColor: "var(--color-danger)", backgroundColor: "#FEF2F2" }}>
        <h1 style={{ fontSize: "20px", color: "var(--color-danger)", margin: "0 0 8px 0" }}>Unable to load patient</h1>
        <p style={{ margin: "0 0 16px 0", color: "var(--color-text-secondary)" }}>{error || "Patient not found."}</p>
        <Link className="btn btn-secondary" href="/doctor/patients">Back to patients</Link>
      </div>
    );
  }

  const activeAssignment = assignments.find((assignment) => assignment.activeAt && Date.now() - new Date(assignment.activeAt).getTime() < 2 * 60_000);

  return (
    <div className="animate-fade-in" style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: "16px", alignItems: "flex-start", flexWrap: "wrap" }}>
        <div>
          <Link href="/doctor/patients" style={{ color: "var(--color-primary)", textDecoration: "none", fontWeight: 600, fontSize: "14px" }}>Back to patients</Link>
          <h1 style={{ fontSize: "28px", fontWeight: 700, margin: "8px 0" }}>{patientName(patient)}</h1>
          <div style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
            <StatusBadge isActive={patient.isActive} archivedAt={patient.archivedAt} />
            <span style={{ color: "var(--color-text-muted)", fontSize: "14px" }}>{patient.email}</span>
          </div>
        </div>
        <div className="responsive-actions">
          <button className="btn btn-secondary" onClick={() => setIsFormOpen(true)}>Edit Profile</button>
          <Link className="btn btn-primary" href={`/doctor/patients/${patient.id}/exercises`}>Assign Exercise</Link>
          <button className="btn btn-secondary" onClick={resetPassword}>Reset Password</button>
          <button className="btn btn-secondary" onClick={toggleStatus}>{patient.isActive ? "Deactivate" : "Activate"}</button>
          {!patient.archivedAt && <button className="btn btn-danger" onClick={archivePatient}>Archive</button>}
        </div>
      </div>

      <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "20px" }}>
        <StatCard title="Assigned Exercises" value={assignments.length} icon={<ActivityIcon />} />
        <StatCard title="Latest Score" value={assignments[0]?.result?.score ?? 0} icon={<ActivityIcon />} />
      </section>

      <section className="doctor-two-column">
        <div className="card" style={{ padding: "24px" }}>
          <h2 style={{ fontSize: "18px", fontWeight: 600, margin: "0 0 20px 0" }}>Patient Profile</h2>
          <div className="doctor-form-grid">
            <DetailField label="First Name" value={patient.profile?.firstName} />
            <DetailField label="Last Name" value={patient.profile?.lastName} />
            <DetailField label="Birth Date" value={patient.profile?.birthDate?.slice(0, 10)} />
            <DetailField label="Gender" value={patient.profile?.gender} />
            <DetailField label="Contact Number" value={patient.profile?.contactNumber} />
            <DetailField label="Email" value={patient.email} />
          </div>
          <div style={{ marginTop: "20px", display: "flex", flexDirection: "column", gap: "16px" }}>
            <DetailField label="Address" value={patient.profile?.address} />
            <DetailField label="Medical Condition" value={patient.profile?.medicalCondition} />
          </div>
        </div>

        <div className="card" style={{ padding: "24px" }}>
          <h2 style={{ fontSize: "18px", fontWeight: 600, margin: "0 0 16px 0" }}>Assigned Exercise Summary</h2>
          {assignments.length === 0 ? (
            <p style={{ margin: 0, color: "var(--color-text-muted)" }}>No exercises assigned yet.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {assignments.slice(0, 5).map((assignment) => (
                <div key={assignment.id} style={{ border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", padding: "12px" }}>
                  <div style={{ fontWeight: 600 }}>{assignment.exercise?.name || "Exercise"}</div>
                  <div style={{ color: "var(--color-text-muted)", fontSize: "13px" }}>Score {assignment.result?.score ?? 0}</div>
                </div>
              ))}
              <Link className="btn btn-secondary btn-full" href={`/doctor/patients/${patient.id}/exercises`}>Manage exercises</Link>
            </div>
          )}
        </div>
      </section>

      <section className="card" style={{ padding: "24px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "center", flexWrap: "wrap", marginBottom: "18px" }}>
          <h2 style={{ fontSize: "18px", fontWeight: 600, margin: 0 }}>Patient Activity</h2>
          {activeAssignment ? <span className="badge badge-blue" style={{ backgroundColor: "#DCFCE7", color: "#166534" }}>Taking {activeAssignment.exercise.name}</span> : <span className="badge badge-blue">Not currently exercising</span>}
        </div>
        <div className="doctor-form-grid">
          <DetailField label="Last online" value={formatTimestamp(patient.lastSeenAt)} />
          <DetailField label="Last login" value={formatTimestamp(patient.lastLoginAt)} />
        </div>
        {assignments.length > 0 && <div style={{ marginTop: "18px", display: "flex", flexDirection: "column", gap: "10px" }}>
          {assignments.map((assignment) => <div key={assignment.id} style={{ borderTop: "1px solid var(--color-border)", paddingTop: "10px", display: "grid", gridTemplateColumns: "minmax(140px, 1fr) repeat(3, minmax(100px, auto))", gap: "12px", fontSize: "13px", alignItems: "center" }}>
            <strong>{assignment.exercise.name}</strong>
            <span style={{ color: "var(--color-text-secondary)" }}>Viewed: {formatTimestamp(assignment.viewedAt)}</span>
            <span style={{ color: "var(--color-text-secondary)" }}>Started: {formatTimestamp(assignment.startedAt)}</span>
            <span style={{ color: "var(--color-text-secondary)" }}>Finished: {formatTimestamp(assignment.completedAt)}</span>
          </div>)}
        </div>}
      </section>

      <section className="card" style={{ padding: "24px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "center", marginBottom: "18px", flexWrap: "wrap" }}>
          <h2 style={{ fontSize: "18px", fontWeight: 600, margin: 0 }}>Care Timeline</h2>
          <span style={{ color: "var(--color-text-muted)", fontSize: "13px" }}>{sessions.length} session{sessions.length === 1 ? "" : "s"}</span>
        </div>
        <CareTimeline sessions={sessions} role="doctor" onCommentSubmit={handleAddComment} isBusy={commentLoading} />
      </section>

      <ChatPanel role="doctor" patientUserId={patient.id} counterpartName={patientName(patient)} />

      <PatientForm isOpen={isFormOpen} initialData={patient} onSave={handleSavePatient} onCancel={() => setIsFormOpen(false)} isLoading={formLoading} />
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        confirmLabel={confirmDialog.confirmLabel}
        isDestructive={confirmDialog.isDestructive}
        isLoading={confirmDialog.isLoading}
        onConfirm={confirmDialog.action}
        onCancel={() => setConfirmDialog((prev) => ({ ...prev, isOpen: false }))}
      />
      <TemporaryPasswordDialog isOpen={isTemporaryPasswordOpen} password={temporaryPassword} onClose={() => setIsTemporaryPasswordOpen(false)} />
    </div>
  );
}
