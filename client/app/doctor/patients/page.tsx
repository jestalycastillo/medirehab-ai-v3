"use client";

import { useEffect, useMemo, useState } from "react";
import { api, ApiError, type ApiPatient, type PatientProfile } from "@/lib/api";
import { PatientForm } from "@/components/doctor/patient-form";
import { PatientList } from "@/components/doctor/patient-list";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { TemporaryPasswordDialog } from "@/components/ui/temporary-password-dialog";

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
    try {
      await api.updatePatient(editingPatient.id, data);
      setIsFormOpen(false);
      setEditingPatient(undefined);
      await loadPatients();
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Failed to save patient.");
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
        } catch (err) {
          alert(err instanceof ApiError ? err.message : "Operation failed.");
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
        } catch (err) {
          alert(err instanceof ApiError ? err.message : "Archive failed.");
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
        } catch (err) {
          alert(err instanceof ApiError ? err.message : "Password reset failed.");
        } finally {
          setConfirmDialog((prev) => ({ ...prev, isOpen: false, isLoading: false }));
        }
      },
    });
  };

  return (
    <div className="animate-fade-in" style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: "16px", flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: "28px", fontWeight: 700, margin: "0 0 8px 0" }}>Patients</h1>
          <p style={{ fontSize: "15px", color: "var(--color-text-secondary)", margin: 0 }}>
            Manage assigned patient accounts and rehabilitation access.
          </p>
        </div>
      </div>

      <div className="card" style={{ padding: "20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "16px", marginBottom: "20px", flexWrap: "wrap" }}>
          <div className="account-tabs" role="tablist" aria-label="Patient account status">
            <button
              type="button"
              className={`account-tab ${accountTab === "ACTIVE" ? "account-tab-active" : ""}`}
              onClick={() => setAccountTab("ACTIVE")}
              role="tab"
              aria-selected={accountTab === "ACTIVE"}
              aria-label={`Active accounts, ${activeAccountCount}`}
              title="Active accounts"
            >
              <ActiveAccountsIcon />
              <span className="account-tab-count">{activeAccountCount}</span>
            </button>
            <button
              type="button"
              className={`account-tab ${accountTab === "ARCHIVED" ? "account-tab-active" : ""}`}
              onClick={() => setAccountTab("ARCHIVED")}
              role="tab"
              aria-selected={accountTab === "ARCHIVED"}
              aria-label={`Archived accounts, ${archivedAccountCount}`}
              title="Archived accounts"
            >
              <ArchivedAccountsIcon />
              <span className="account-tab-count">{archivedAccountCount}</span>
            </button>
          </div>
        </div>

        <div className="doctor-toolbar" style={{ marginBottom: "20px" }}>
          <input
            type="text"
            className="input"
            placeholder="Search name, email, or condition"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            style={{ maxWidth: "340px" }}
          />
          {accountTab === "ACTIVE" && (
            <select className="input" value={filterStatus} onChange={(event) => setFilterStatus(event.target.value)} style={{ maxWidth: "170px" }}>
              <option value="ALL">All status</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </select>
          )}
        </div>

        {error && (
          <div style={{ padding: "14px 16px", backgroundColor: "#FEF2F2", color: "var(--color-danger)", borderRadius: "var(--radius-md)", marginBottom: "20px" }}>
            {error}
          </div>
        )}

        {loading ? (
          <div style={{ display: "flex", justifyContent: "center", padding: "48px" }}><div className="spinner" /></div>
        ) : (
          <PatientList
            patients={filteredPatients}
            onEdit={(patient) => { setEditingPatient(patient); setIsFormOpen(true); }}
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
