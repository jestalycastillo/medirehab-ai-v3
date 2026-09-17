"use client";

import { useEffect, useMemo, useState } from "react";
import { api, ApiError, type ApiPatient, type PatientProfile } from "@/lib/api";
import { PatientForm } from "@/components/doctor/patient-form";
import { PatientList } from "@/components/doctor/patient-list";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { TemporaryPasswordDialog } from "@/components/ui/temporary-password-dialog";
import { CheckCircle2, CircleAlert } from "lucide-react";

function ActiveAccountsIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <polyline points="16 11 18 13 22 9" />
    </svg>
  );
}

function ArchivedAccountsIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="21 8 21 21 3 21 3 8" />
      <rect x="1" y="3" width="22" height="5" />
      <line x1="10" y1="12" x2="14" y2="12" />
    </svg>
  );
}

function buildGeneratedPassword() {
  return `Temp${Math.random().toString(36).slice(2, 8)}!9A`;
}

export default function DoctorPatientsPage() {
  const [patients, setPatients] = useState<ApiPatient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [formError, setFormError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("ALL");
  const [accountTab, setAccountTab] = useState<"ACTIVE" | "ARCHIVED">("ACTIVE");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingPatient, setEditingPatient] = useState<ApiPatient | undefined>();
  const [formLoading, setFormLoading] = useState(false);
  const [temporaryPassword, setTemporaryPassword] = useState("");
  const [isTemporaryPasswordOpen, setIsTemporaryPasswordOpen] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmLabel?: string;
    isDestructive: boolean;
    isLoading: boolean;
    action: () => Promise<void>;
  }>({
    isOpen: false,
    title: "",
    message: "",
    isDestructive: false,
    isLoading: false,
    action: async () => {},
  });

  const loadPatients = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await api.getPatients();
      setPatients(res.patients);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load patients.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadPatients();
  }, []);

  const filteredPatients = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return patients.filter((patient) => {
      const profile = patient.profile;
      const isArchived = Boolean(patient.archivedAt);
      const matchesSearch =
        !query ||
        patient.email.toLowerCase().includes(query) ||
        profile?.firstName?.toLowerCase().includes(query) ||
        profile?.lastName?.toLowerCase().includes(query) ||
        profile?.medicalCondition?.toLowerCase().includes(query);
      const matchesTab =
        accountTab === "ARCHIVED" ? isArchived : !isArchived;
      const matchesStatus =
        accountTab === "ARCHIVED" ||
        filterStatus === "ALL" ||
        (filterStatus === "ACTIVE" && patient.isActive) ||
        (filterStatus === "INACTIVE" && !patient.isActive);
      return matchesTab && matchesSearch && matchesStatus;
    });
  }, [patients, searchTerm, filterStatus, accountTab]);

  const activeAccountCount = patients.filter((patient) => !patient.archivedAt).length;
  const archivedAccountCount = patients.filter((patient) => patient.archivedAt).length;

  const handleSavePatient = async (data: Partial<ApiPatient & PatientProfile>) => {
    if (!editingPatient) return;
    setFormLoading(true);
    setFormError("");
    try {
      await api.updatePatient(editingPatient.id, data);
      setIsFormOpen(false);
      setEditingPatient(undefined);
      await loadPatients();
      setSuccess("Patient updated.");
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Failed to save patient.");
    } finally {
      setFormLoading(false);
    }
  };

  const openConfirm = (options: Omit<typeof confirmDialog, "isOpen" | "isLoading">) => {
    setConfirmDialog({ ...options, isOpen: true, isLoading: false });
  };

  const patientName = (patient: ApiPatient) =>
    [patient.profile?.firstName, patient.profile?.lastName].filter(Boolean).join(" ") || patient.email;

  const handleToggleStatus = (patient: ApiPatient) => {
    openConfirm({
      title: `${patient.isActive ? "Deactivate" : "Activate"} Patient`,
      message: `Are you sure you want to ${patient.isActive ? "deactivate" : "activate"} ${patientName(patient)}?`,
      confirmLabel: patient.isActive ? "Deactivate" : "Activate",
      isDestructive: patient.isActive,
      action: async () => {
        setConfirmDialog((prev) => ({ ...prev, isLoading: true }));
        try {
          await api.updatePatientStatus(patient.id, !patient.isActive);
          await loadPatients();
          setSuccess(`${patientName(patient)} ${patient.isActive ? "deactivated" : "activated"}.`);
        } catch (err) {
          setSuccess("");
          setError(err instanceof ApiError ? err.message : "Status update failed.");
        } finally {
          setConfirmDialog((prev) => ({ ...prev, isOpen: false, isLoading: false }));
        }
      },
    });
  };

  const handleArchive = (patient: ApiPatient) => {
    openConfirm({
      title: "Archive Patient",
      message: `Archive ${patientName(patient)}? This removes the patient from active care lists.`,
      confirmLabel: "Archive",
      isDestructive: true,
      action: async () => {
        setConfirmDialog((prev) => ({ ...prev, isLoading: true }));
        try {
          await api.deletePatient(patient.id);
          await loadPatients();
          setSuccess(`${patientName(patient)} archived.`);
        } catch (err) {
          setSuccess("");
          setError(err instanceof ApiError ? err.message : "Archive failed.");
        } finally {
          setConfirmDialog((prev) => ({ ...prev, isOpen: false, isLoading: false }));
        }
      },
    });
  };

  const handleResetPassword = (patient: ApiPatient) => {
    const nextPassword = buildGeneratedPassword();
    openConfirm({
      title: "Reset Patient Password",
      message: `Reset the password for ${patientName(patient)}? A new temporary password will be shown after the reset.`,
      confirmLabel: "Reset Password",
      isDestructive: false,
      action: async () => {
        setConfirmDialog((prev) => ({ ...prev, isLoading: true }));
        try {
          await api.resetPatientPassword(patient.id, nextPassword);
          setTemporaryPassword(nextPassword);
          setIsTemporaryPasswordOpen(true);
          setSuccess(`${patientName(patient)}'s password was reset.`);
        } catch (err) {
          setSuccess("");
          setError(err instanceof ApiError ? err.message : "Password reset failed.");
        } finally {
          setConfirmDialog((prev) => ({ ...prev, isOpen: false, isLoading: false }));
        }
      },
    });
  };

  return (
    <div className="role-dashboard care-page animate-fade-in">
      <header className="role-dashboard-header">
        <div>
          <span className="role-dashboard-eyebrow">Doctor / Patients</span>
          <h1>Patients</h1>
          <p>
            Manage assigned patient accounts and rehabilitation access.
          </p>
        </div>
      </header>

      <div className="card care-page-panel">
        <div className="admin-subpage-panel-heading">
          <div><span className="role-dashboard-eyebrow">Directory</span><h2>Patient accounts</h2></div>
          <p>{activeAccountCount} current · {archivedAccountCount} archived</p>
        </div>
        <div className="admin-directory-toolbar">
          <div className="account-tabs" role="group" aria-label="Patient account status">
            <button
              type="button"
              className={`account-tab ${accountTab === "ACTIVE" ? "account-tab-active" : ""}`}
              onClick={() => setAccountTab("ACTIVE")}
              aria-pressed={accountTab === "ACTIVE"}
              aria-label={`Current accounts, ${activeAccountCount}`}
              title="Current accounts"
            >
              <ActiveAccountsIcon />
              <span>Current</span>
              <span className="account-tab-count">{activeAccountCount}</span>
            </button>
            <button
              type="button"
              className={`account-tab ${accountTab === "ARCHIVED" ? "account-tab-active" : ""}`}
              onClick={() => setAccountTab("ARCHIVED")}
              aria-pressed={accountTab === "ARCHIVED"}
              aria-label={`Archived accounts, ${archivedAccountCount}`}
              title="Archived accounts"
            >
              <ArchivedAccountsIcon />
              <span>Archived</span>
              <span className="account-tab-count">{archivedAccountCount}</span>
            </button>
          </div>
        <div className="doctor-toolbar care-page-filters">
          <input
            type="text"
            className="input"
            aria-label="Search patients by name, email, or condition"
            placeholder="Search name, email, or condition"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            style={{ maxWidth: "340px" }}
          />
          {accountTab === "ACTIVE" && (
            <select className="input" aria-label="Filter patients by status" value={filterStatus} onChange={(event) => setFilterStatus(event.target.value)} style={{ maxWidth: "170px" }}>
              <option value="ALL">All status</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </select>
          )}
        </div>
        </div>

        {error && <div className="admin-feedback admin-feedback-error" role="alert"><CircleAlert aria-hidden="true" />{error}</div>}
        {success && <div className="admin-feedback admin-feedback-success" role="status"><CheckCircle2 aria-hidden="true" />{success}</div>}
        {!loading && <p className="admin-directory-result-count" role="status">Showing {filteredPatients.length} {accountTab === "ARCHIVED" ? "archived" : "current"} patient{filteredPatients.length === 1 ? "" : "s"}{searchTerm.trim() ? " matching your search" : ""}.</p>}

        {loading ? (
          <div className="admin-directory-loading" role="status"><div className="spinner" aria-hidden="true" />Loading patients…</div>
        ) : (
          <PatientList
            patients={filteredPatients}
            onEdit={(patient) => { setEditingPatient(patient); setFormError(""); setIsFormOpen(true); }}
            onToggleStatus={handleToggleStatus}
            onArchive={handleArchive}
            onResetPassword={handleResetPassword}
            emptyMessage={accountTab === "ARCHIVED" ? "No archived patients found." : "No active patient accounts found."}
          />
        )}
      </div>

      <PatientForm
        isOpen={isFormOpen}
        initialData={editingPatient}
        onSave={handleSavePatient}
        onCancel={() => { setIsFormOpen(false); setEditingPatient(undefined); }}
        isLoading={formLoading}
        error={formError}
      />
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
      <TemporaryPasswordDialog
        isOpen={isTemporaryPasswordOpen}
        password={temporaryPassword}
        onClose={() => setIsTemporaryPasswordOpen(false)}
      />
    </div>
  );
}
