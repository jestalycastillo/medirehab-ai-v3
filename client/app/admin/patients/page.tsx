"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { api, ApiError, type ApiDoctor, type ApiPatient, type PatientProfile } from "@/lib/api";
import { StatusBadge } from "@/components/ui/status-badge";
import { PatientForm } from "@/components/doctor/patient-form";
import { TemporaryPasswordDialog } from "@/components/ui/temporary-password-dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { usePortalModalFocus } from "@/components/ui/use-portal-modal-focus";
import { CheckCircle2, CircleAlert } from "lucide-react";

function PlusIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function ArchiveIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="21 8 21 21 3 21 3 8" />
      <rect x="1" y="3" width="22" height="5" />
      <line x1="10" y1="12" x2="14" y2="12" />
    </svg>
  );
}

function ActiveAccountsIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <polyline points="16 11 18 13 22 9" />
    </svg>
  );
}

function buildGeneratedPassword() {
  return `Temp${Math.random().toString(36).slice(2, 8)}!9A`;
}

function patientName(patient: ApiPatient) {
  return [patient.profile?.firstName, patient.profile?.lastName].filter(Boolean).join(" ") || "Unnamed patient";
}

function doctorName(doctor?: ApiDoctor) {
  return [doctor?.profile?.firstName, doctor?.profile?.lastName].filter(Boolean).join(" ") || doctor?.email || "";
}

function assignedDoctorName(patient: ApiPatient) {
  const assigned = patient.profile?.assignedDoctor;
  const name = [assigned?.firstName, assigned?.lastName].filter(Boolean).join(" ");
  return name || assigned?.user?.email || "Unassigned";
}

export default function AdminPatientsPage() {
  const [patients, setPatients] = useState<ApiPatient[]>([]);
  const [doctors, setDoctors] = useState<ApiDoctor[]>([]);
  const [selectedDoctors, setSelectedDoctors] = useState<Record<string, string>>({});
  const [viewingPatient, setViewingPatient] = useState<ApiPatient | null>(null);
  const detailModalRef = usePortalModalFocus(Boolean(viewingPatient), () => setViewingPatient(null));
  const [savingPatientId, setSavingPatientId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [accountTab, setAccountTab] = useState<"ACTIVE" | "ARCHIVED">("ACTIVE");

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingPatient, setEditingPatient] = useState<ApiPatient | undefined>(undefined);
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState("");
  const [tempPassword, setTempPassword] = useState("");
  const [isTempPasswordOpen, setIsTempPasswordOpen] = useState(false);

  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    action: () => Promise<void>;
    isDestructive: boolean;
    isLoading: boolean;
  }>({
    isOpen: false,
    title: "",
    message: "",
    action: async () => {},
    isDestructive: false,
    isLoading: false,
  });

  const loadData = async () => {
    setError("");
    try {
      const [patientsRes, doctorsRes] = await Promise.all([
        api.getAdminPatients(),
        api.getDoctors(),
      ]);
      setPatients(patientsRes.patients);
      setDoctors(doctorsRes.doctors);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load patients.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadData();
  }, []);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("create") === "1") {
      setEditingPatient(undefined);
      setFormError("");
      setIsFormOpen(true);
    }
  }, []);

  const activeDoctors = doctors.filter((doctor) => doctor.isActive && !doctor.archivedAt);
  const filteredPatients = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return patients.filter((patient) => {
      const isArchived = Boolean(patient.archivedAt);
      const matchesSearch =
        !query ||
        patient.email.toLowerCase().includes(query) ||
        patient.profile?.firstName?.toLowerCase().includes(query) ||
        patient.profile?.lastName?.toLowerCase().includes(query) ||
        patient.profile?.medicalCondition?.toLowerCase().includes(query);

      const matchesTab =
        accountTab === "ARCHIVED" ? isArchived : !isArchived;

      return matchesTab && matchesSearch;
    });
  }, [patients, searchTerm, accountTab]);

  const activeAccountCount = patients.filter((p) => !p.archivedAt).length;
  const archivedAccountCount = patients.filter((p) => p.archivedAt).length;

  const handleAssign = async (patient: ApiPatient) => {
    const doctorUserId = selectedDoctors[patient.id];
    if (!doctorUserId) {
      setError("Select a doctor before assigning.");
      return;
    }

    setSavingPatientId(patient.id);
    setError("");
    setSuccess("");
    try {
      await api.assignPatientToDoctor(patient.id, doctorUserId);
      setSuccess(`${patientName(patient)} assigned successfully.`);
      await loadData();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to assign patient.");
    } finally {
      setSavingPatientId("");
    }
  };

  const handleSavePatient = async (data: Partial<ApiPatient & PatientProfile>) => {
    setFormLoading(true);
    setFormError("");
    setSuccess("");
    try {
      if (editingPatient) {
        await api.updatePatient(editingPatient.id, data);
        setSuccess("Patient updated successfully.");
      } else {
        const res = await api.createPatient(data);
        if (res.temporaryPassword) {
          setTempPassword(res.temporaryPassword);
          setIsTempPasswordOpen(true);
        }
        setSuccess("Patient created successfully.");
      }
      await loadData();
      setIsFormOpen(false);
      setEditingPatient(undefined);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Failed to save patient.");
    } finally {
      setFormLoading(false);
    }
  };

  const handleArchive = (patient: ApiPatient) => {
    setConfirmDialog({
      isOpen: true,
      title: "Archive Patient",
      message: `Are you sure you want to archive ${patientName(patient)}? This removes the patient from active care lists.`,
      isDestructive: true,
      isLoading: false,
      action: async () => {
        setConfirmDialog((prev) => ({ ...prev, isLoading: true }));
        try {
          await api.deletePatient(patient.id);
          await loadData();
          setSuccess(`${patientName(patient)} archived.`);
        } catch (err) {
          setSuccess("");
          setError(err instanceof ApiError ? err.message : "Archive failed");
        } finally {
          setConfirmDialog((prev) => ({ ...prev, isOpen: false, isLoading: false }));
        }
      },
    });
  };

  const handlePermanentDelete = (patient: ApiPatient) => {
    setConfirmDialog({
      isOpen: true,
      title: "Delete Patient Permanently",
      message: `Delete ${patientName(patient)} permanently? This will remove the account and related patient data from the database.`,
      isDestructive: true,
      isLoading: false,
      action: async () => {
        setConfirmDialog((prev) => ({ ...prev, isLoading: true }));
        try {
          await api.permanentlyDeletePatient(patient.id);
          await loadData();
          setSuccess(`${patientName(patient)} deleted permanently.`);
        } catch (err) {
          setSuccess("");
          setError(err instanceof ApiError ? err.message : "Delete failed");
        } finally {
          setConfirmDialog((prev) => ({ ...prev, isOpen: false, isLoading: false }));
        }
      },
    });
  };

  const handleRestore = (patient: ApiPatient) => {
    setConfirmDialog({
      isOpen: true,
      title: "Restore Patient",
      message: `Restore ${patientName(patient)} to active use?`,
      isDestructive: false,
      isLoading: false,
      action: async () => {
        setConfirmDialog((prev) => ({ ...prev, isLoading: true }));
        try {
          await api.updatePatientStatus(patient.id, true);
          await loadData();
          setSuccess(`${patientName(patient)} restored.`);
        } catch (err) {
          setSuccess("");
          setError(err instanceof ApiError ? err.message : "Restore failed");
        } finally {
          setConfirmDialog((prev) => ({ ...prev, isOpen: false, isLoading: false }));
        }
      },
    });
  };

  const openPatientPersona = (patient: ApiPatient) => {
    setViewingPatient(patient);
  };

  const handleResetPassword = (patient: ApiPatient) => {
    const nextPassword = buildGeneratedPassword();
    setConfirmDialog({
      isOpen: true,
      title: "Reset Patient Password",
      message: `Reset password for ${patientName(patient)}? A new temporary password will be shown after reset.`,
      isDestructive: false,
      isLoading: false,
      action: async () => {
        setConfirmDialog((prev) => ({ ...prev, isLoading: true }));
        try {
          await api.resetPatientPassword(patient.id, nextPassword);
          setTempPassword(nextPassword);
          setIsTempPasswordOpen(true);
          setSuccess(`${patientName(patient)}'s password was reset.`);
        } catch (err) {
          setSuccess("");
          setError(err instanceof ApiError ? err.message : "Password reset failed");
        } finally {
          setConfirmDialog((prev) => ({ ...prev, isOpen: false, isLoading: false }));
        }
      },
    });
  };

  return (
    <div className="role-dashboard admin-subpage animate-fade-in">
      <header className="role-dashboard-header">
        <div>
          <span className="role-dashboard-eyebrow">Admin / Patients</span>
          <h1>Patients</h1>
          <p>Assign patient accounts to active doctors.</p>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => {
            setEditingPatient(undefined);
            setFormError("");
            setIsFormOpen(true);
          }}
        >
          <PlusIcon /> Add Patient
        </button>
      </header>

      <section className="card admin-subpage-panel" aria-label="Patient accounts">
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
              <ArchiveIcon />
              <span>Archived</span>
              <span className="account-tab-count">{archivedAccountCount}</span>
            </button>
          </div>
          <div className="admin-directory-filters">
          <input
            className="input"
            type="text"
            aria-label="Search patients by name, email, or condition"
            placeholder="Search name, email, or condition"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            style={{ maxWidth: "340px" }}
          />
          </div>
        </div>

        {!loading && accountTab === "ACTIVE" && activeDoctors.length === 0 && activeAccountCount > 0 && (
          <div className="admin-feedback admin-feedback-warning" role="status">
            <CircleAlert aria-hidden="true" />
            <span>No active doctors are available for assignment. <Link href="/admin/doctors">Manage doctors</Link> to add or restore one.</span>
          </div>
        )}

        {error && <div className="admin-feedback admin-feedback-error" role="alert"><CircleAlert aria-hidden="true" />{error}</div>}

        {success && <div className="admin-feedback admin-feedback-success" role="status"><CheckCircle2 aria-hidden="true" />{success}</div>}

        {!loading && <p className="admin-directory-result-count" role="status">Showing {filteredPatients.length} {accountTab === "ARCHIVED" ? "archived" : "current"} patient{filteredPatients.length === 1 ? "" : "s"}{searchTerm.trim() ? " matching your search" : ""}.</p>}

        {loading ? (
          <div className="admin-directory-loading" role="status"><div className="spinner" aria-hidden="true" />Loading patients…</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="admin-directory-table admin-directory-table-patients" style={{ width: "100%", textAlign: "left" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--color-border)", color: "var(--color-text-muted)", fontSize: "14px" }}>
                  <th style={{ padding: "12px 16px", fontWeight: 600 }}>Patient</th>
                  <th style={{ padding: "12px 16px", fontWeight: 600 }}>Doctor</th>
                  <th style={{ padding: "12px 16px", fontWeight: 600 }}>Status</th>
                  <th style={{ padding: "12px 16px", fontWeight: 600, textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredPatients.length === 0 ? (
                  <tr>
                    <td colSpan={4}>
                      <div className="admin-directory-empty">
                        <ActiveAccountsIcon />
                        <strong>{searchTerm ? "No matching patients" : accountTab === "ARCHIVED" ? "No archived patients" : "No current patients"}</strong>
                        <p>{searchTerm ? "Try a different name, email, or condition." : accountTab === "ARCHIVED" ? "Archived patient accounts will appear here." : "Add a patient to start managing care assignments."}</p>
                        {searchTerm && <button type="button" className="btn btn-secondary" onClick={() => setSearchTerm("")}>Clear search</button>}
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredPatients.map((patient) => (
                    <tr key={patient.id} className="directory-data-row">
                      <td data-label="Patient" style={{ padding: "12px 16px" }}>
                        <button
                          type="button"
                          className="directory-name-button"
                          onClick={() => openPatientPersona(patient)}
                        >
                          {patientName(patient)}
                        </button>
                        <div className="directory-row-meta">{patient.email}</div>
                        {patient.profile?.medicalCondition && <div className="directory-row-meta">{patient.profile.medicalCondition}</div>}
                      </td>
                      <td data-label="Doctor" style={{ padding: "12px 16px", color: "var(--color-text-secondary)", fontSize: "14px" }}>
                        {assignedDoctorName(patient)}
                      </td>
                      <td data-label="Status" style={{ padding: "12px 16px" }}>
                        <StatusBadge isActive={patient.isActive} archivedAt={patient.archivedAt} />
                      </td>
                      <td data-label="Actions" style={{ padding: "12px 16px", textAlign: "right" }}>
                        <div className="directory-row-actions">
                          {accountTab === "ACTIVE" && <>
                          <select
                            className="input directory-doctor-select"
                            aria-label={`Choose doctor for ${patientName(patient)}`}
                            value={selectedDoctors[patient.id] || ""}
                            onChange={(event) => setSelectedDoctors((prev) => ({ ...prev, [patient.id]: event.target.value }))}
                          >
                            <option value="">Select doctor</option>
                            {activeDoctors.map((doctor) => (
                              <option key={doctor.id} value={doctor.id}>
                                {doctorName(doctor)}
                              </option>
                            ))}
                          </select>
                          <button
                            className="btn btn-primary"
                            onClick={() => handleAssign(patient)}
                            disabled={savingPatientId === patient.id || !selectedDoctors[patient.id]}
                          >
                            {savingPatientId === patient.id ? <><span className="spinner spinner-white" style={{ width: "16px", height: "16px" }} aria-hidden="true" />Assigning…</> : "Assign"}
                          </button>
                          </>}
                          <details className="list-row-actions">
                            <summary>More</summary>
                            <div>
                              {accountTab === "ACTIVE" && <button onClick={() => { setEditingPatient(patient); setFormError(""); setIsFormOpen(true); }}>Edit profile</button>}
                              <button onClick={() => handleResetPassword(patient)}>Reset password</button>
                              {!patient.archivedAt && <button onClick={() => handleArchive(patient)}>Archive</button>}
                              {patient.archivedAt && <button onClick={() => handleRestore(patient)}>Restore</button>}
                              {patient.archivedAt && <button className="list-row-action-danger" onClick={() => handlePermanentDelete(patient)}>Delete permanently</button>}
                            </div>
                          </details>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

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
        isDestructive={confirmDialog.isDestructive}
        isLoading={confirmDialog.isLoading}
        onConfirm={confirmDialog.action}
        onCancel={() => setConfirmDialog((prev) => ({ ...prev, isOpen: false }))}
      />

      <TemporaryPasswordDialog
        isOpen={isTempPasswordOpen}
        password={tempPassword}
        onClose={() => setIsTempPasswordOpen(false)}
      />

      {viewingPatient && (
        <div className="portal-modal-overlay" onClick={() => setViewingPatient(null)}>
          <div
            ref={detailModalRef} tabIndex={-1}
            className="portal-modal-panel portal-modal-detail animate-slide-up"
            role="dialog" aria-modal="true" aria-labelledby="patient-detail-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="portal-modal-header portal-modal-detail-heading">
              <div>
                <span className="role-dashboard-eyebrow">Patient account</span>
                <h2 id="patient-detail-title">
                  {patientName(viewingPatient)}
                </h2>
                <div style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
                  <StatusBadge isActive={viewingPatient.isActive} archivedAt={viewingPatient.archivedAt} />
                  <span style={{ color: "var(--color-text-muted)", fontSize: "14px" }}>{viewingPatient.email}</span>
                </div>
              </div>
              <button
                className="btn btn-secondary"
                onClick={() => setViewingPatient(null)}
              >
                Close
              </button>
            </div>

            <div className="portal-modal-detail-body">
            <h3>Profile information</h3>
            <div className="doctor-form-grid">
              <DetailField label="First Name" value={viewingPatient.profile?.firstName} />
              <DetailField label="Last Name" value={viewingPatient.profile?.lastName} />
              <DetailField label="Birth Date" value={viewingPatient.profile?.birthDate?.slice(0, 10)} />
              <DetailField label="Gender" value={viewingPatient.profile?.gender} />
              <DetailField label="Contact Number" value={viewingPatient.profile?.contactNumber} />
              <DetailField label="Assigned Doctor" value={assignedDoctorName(viewingPatient)} />
            </div>

            <div style={{ marginTop: "20px", display: "grid", gap: "16px" }}>
              <DetailField label="Address" value={viewingPatient.profile?.address} />
              <DetailField label="Medical Condition" value={viewingPatient.profile?.medicalCondition} />
            </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DetailField({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <div style={{ fontSize: "12px", fontWeight: 700, textTransform: "uppercase", color: "var(--color-text-muted)", marginBottom: "4px" }}>{label}</div>
      <div style={{ color: "var(--color-text-primary)", fontWeight: 500 }}>{value || "-"}</div>
    </div>
  );
}
