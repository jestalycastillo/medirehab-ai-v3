"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { api, ApiError, type ApiDoctor } from "@/lib/api";
import { StatusBadge } from "@/components/ui/status-badge";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { TemporaryPasswordDialog } from "@/components/ui/temporary-password-dialog";
import { CheckCircle2, CircleAlert } from "lucide-react";

function buildGeneratedPassword() {
  return `Temp${Math.random().toString(36).slice(2, 8)}!9A`;
}

function doctorName(doctor?: ApiDoctor | null) {
  if (!doctor) return "Doctor";
  const name = [doctor.profile?.firstName, doctor.profile?.lastName].filter(Boolean).join(" ");
  return name ? `Dr. ${name}` : doctor.email;
}

function DetailField({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <div style={{ fontSize: "12px", fontWeight: 700, color: "var(--color-text-muted)", textTransform: "uppercase", marginBottom: "4px" }}>{label}</div>
      <div style={{ color: "var(--color-text-primary)", fontWeight: 600 }}>{value || "-"}</div>
    </div>
  );
}

export default function AdminDoctorDetailPage() {
  const params = useParams<{ doctorUserId: string }>();
  const doctorUserId = params.doctorUserId;
  const [doctor, setDoctor] = useState<ApiDoctor | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [success, setSuccess] = useState("");
  const [temporaryPassword, setTemporaryPassword] = useState("");
  const [isTemporaryPasswordOpen, setIsTemporaryPasswordOpen] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState({
    isOpen: false,
    title: "",
    message: "",
    isLoading: false,
    action: async () => {},
  });

  const loadDoctor = async () => {
    setError("");
    try {
      const res = await api.getDoctor(doctorUserId);
      setDoctor(res.doctor);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load doctor.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadDoctor();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doctorUserId]);

  const handleResetPassword = () => {
    if (!doctor) return;
    setActionError("");
    const nextPassword = buildGeneratedPassword();
    setConfirmDialog({
      isOpen: true,
      title: "Reset Doctor Password",
      message: `Reset password for ${doctorName(doctor)}? A new temporary password will be shown after reset.`,
      isLoading: false,
      action: async () => {
        setConfirmDialog((prev) => ({ ...prev, isLoading: true }));
        try {
          await api.resetDoctorPassword(doctor.id, nextPassword);
          setTemporaryPassword(nextPassword);
          setIsTemporaryPasswordOpen(true);
          setSuccess("Doctor password reset.");
        } catch (err) {
          setActionError(err instanceof ApiError ? err.message : "Password reset failed.");
        } finally {
          setConfirmDialog((prev) => ({ ...prev, isOpen: false, isLoading: false }));
        }
      },
    });
  };

  if (loading) {
    return <div className="role-dashboard-loading" role="status"><div className="spinner" aria-hidden="true" />Loading doctor profile…</div>;
  }

  if (error || !doctor) {
    return (
      <div className="card" role="alert" style={{ padding: "24px", borderColor: "var(--color-danger)", backgroundColor: "var(--color-danger-surface)" }}>
        <h1 style={{ color: "var(--color-danger)", fontSize: "20px", margin: "0 0 8px 0" }}>Unable to load doctor</h1>
        <p style={{ color: "var(--color-text-secondary)", margin: "0 0 16px 0" }}>{error || "Doctor not found."}</p>
        <Link className="btn btn-secondary" href="/admin/doctors">Back to doctors</Link>
      </div>
    );
  }

  return (
    <div className="role-dashboard admin-subpage animate-fade-in">
      <header className="role-dashboard-header">
        <div>
          <Link className="care-page-back" href="/admin/doctors">Back to doctors</Link>
          <span className="role-dashboard-eyebrow">Admin / Doctor account</span>
          <h1>{doctorName(doctor)}</h1>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
            <StatusBadge isActive={doctor.isActive} archivedAt={doctor.archivedAt} />
            <span style={{ color: "var(--color-text-muted)", fontSize: "14px" }}>{doctor.email}</span>
          </div>
        </div>
        <button className="btn btn-secondary" onClick={handleResetPassword}>Reset Password</button>
      </header>

      {actionError && <div className="admin-feedback admin-feedback-error" role="alert"><CircleAlert aria-hidden="true" />{actionError}</div>}
      {success && <div className="admin-feedback admin-feedback-success" role="status"><CheckCircle2 aria-hidden="true" />{success}</div>}

      <section className="card admin-subpage-panel" style={{ maxWidth: "760px" }}>
        <h2 style={{ fontSize: "18px", fontWeight: 600, margin: "0 0 20px 0" }}>Doctor Profile</h2>
        <div className="doctor-form-grid">
          <DetailField label="First Name" value={doctor.profile?.firstName} />
          <DetailField label="Last Name" value={doctor.profile?.lastName} />
          <DetailField label="Specialization" value={doctor.profile?.specialization} />
          <DetailField label="License Number" value={doctor.profile?.licenseNumber} />
          <DetailField label="Contact Number" value={doctor.profile?.contactNumber} />
          <DetailField label="Clinic Schedule" value={doctor.profile?.clinicSchedule} />
        </div>
      </section>

      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        confirmLabel="Reset Password"
        isLoading={confirmDialog.isLoading}
        onConfirm={confirmDialog.action}
        onCancel={() => setConfirmDialog((prev) => ({ ...prev, isOpen: false }))}
      />
      <TemporaryPasswordDialog
        isOpen={isTemporaryPasswordOpen}
        password={temporaryPassword}
        onClose={() => setIsTemporaryPasswordOpen(false)}
      />
    </div>
  );
}
