"use client";

import { useEffect, useMemo, useState } from "react";
import { api, ApiError, type ApiDoctor, type ApiPatient, type PatientProfile } from "@/lib/api";
import { StatusBadge } from "@/components/ui/status-badge";
import { PatientForm } from "@/components/doctor/patient-form";
import { TemporaryPasswordDialog } from "@/components/ui/temporary-password-dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

function PlusIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function EditIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
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

function TrashIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    </svg>
  );
}

function RestoreIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12a9 9 0 1 0 3-6.7" />
      <path d="M3 3v6h6" />
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

function KeyIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
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
  const [savingPatientId, setSavingPatientId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [accountTab, setAccountTab] = useState<"ACTIVE" | "ARCHIVED">("ACTIVE");

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingPatient, setEditingPatient] = useState<ApiPatient | undefined>(undefined);
  const [formLoading, setFormLoading] = useState(false);
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
    setError("");
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
      setError(err instanceof ApiError ? err.message : "Failed to save patient.");
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
        } catch (err) {
          alert(err instanceof ApiError ? err.message : "Archive failed");
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
        } catch (err) {
          alert(err instanceof ApiError ? err.message : "Delete failed");
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
        } catch (err) {
          alert(err instanceof ApiError ? err.message : "Restore failed");
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
        } catch (err) {
          alert(err instanceof ApiError ? err.message : "Password reset failed");
        } finally {
          setConfirmDialog((prev) => ({ ...prev, isOpen: false, isLoading: false }));
        }
      },
    });
  };

  return (
    <div className="animate-fade-in" style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <h1 style={{ fontSize: "28px", fontWeight: 700, margin: "0 0 8px 0" }}>Patients</h1>
          <p style={{ color: "var(--color-text-secondary)", margin: 0 }}>
            Assign patient accounts to active doctors.
          </p>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => {
            setEditingPatient(undefined);
            setIsFormOpen(true);
          }}
        >
          <PlusIcon /> Add Patient
        </button>
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
              <ArchiveIcon />
              <span className="account-tab-count">{archivedAccountCount}</span>
            </button>
          </div>
        </div>

        <div className="doctor-toolbar" style={{ marginBottom: "20px" }}>
          <input
            className="input"
            type="text"
            placeholder="Search name, email, or condition"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            style={{ maxWidth: "340px" }}
          />
        </div>

        {error && (
          <div style={{ padding: "14px 16px", backgroundColor: "#FEF2F2", color: "var(--color-danger)", borderRadius: "var(--radius-md)", marginBottom: "16px" }}>
            {error}
          </div>
        )}

        {success && (
          <div style={{ padding: "14px 16px", backgroundColor: "#DCFCE7", color: "#166534", borderRadius: "var(--radius-md)", marginBottom: "16px" }}>
            {success}
          </div>
        )}

        {loading ? (
          <div style={{ display: "flex", justifyContent: "center", padding: "48px" }}><div className="spinner" /></div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--color-border)", color: "var(--color-text-muted)", fontSize: "14px" }}>
                  <th style={{ padding: "12px 16px", fontWeight: 600 }}>Patient</th>
                  <th style={{ padding: "12px 16px", fontWeight: 600 }}>Condition</th>
                  <th style={{ padding: "12px 16px", fontWeight: 600 }}>Current Doctor</th>
                  <th style={{ padding: "12px 16px", fontWeight: 600 }}>Status</th>
                  {accountTab === "ACTIVE" && <th style={{ padding: "12px 16px", fontWeight: 600 }}>Assign Doctor</th>}
                  <th style={{ padding: "12px 16px", fontWeight: 600, textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredPatients.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ padding: "40px", textAlign: "center", color: "var(--color-text-muted)" }}>
                      {accountTab === "ARCHIVED" ? "No archived patients found." : "No active patients found."}
                    </td>
                  </tr>
                ) : (
                  filteredPatients.map((patient) => (
                    <tr key={patient.id} style={{ borderBottom: "1px solid var(--color-page-bg)" }}>
                      <td style={{ padding: "12px 16px" }}>
                        <button
                          type="button"
                          onClick={() => openPatientPersona(patient)}
                          style={{
                            fontWeight: 600,
                            color: "var(--color-primary)",
                            background: "none",
                            border: "none",
                            padding: 0,
                            cursor: "pointer",
                            textAlign: "left",
                          }}
                        >
                          {patientName(patient)}
                        </button>
                        <div style={{ color: "var(--color-text-muted)", fontSize: "13px" }}>{patient.email}</div>
                      </td>
                      <td style={{ padding: "12px 16px", color: "var(--color-text-secondary)", fontSize: "14px" }}>
                        {patient.profile?.medicalCondition || "-"}
                      </td>
                      <td style={{ padding: "12px 16px", color: "var(--color-text-secondary)", fontSize: "14px" }}>
                        {assignedDoctorName(patient)}
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        <StatusBadge isActive={patient.isActive} archivedAt={patient.archivedAt} />
                      </td>
                      {accountTab === "ACTIVE" && (
                        <td style={{ padding: "12px 16px" }}>
                          <select
                            className="input"
                            value={selectedDoctors[patient.id] || ""}
                            onChange={(event) => setSelectedDoctors((prev) => ({ ...prev, [patient.id]: event.target.value }))}
                            style={{ minWidth: "220px" }}
                          >
                            <option value="">Select doctor</option>
                            {activeDoctors.map((doctor) => (
                              <option key={doctor.id} value={doctor.id}>
                                {doctorName(doctor)}
                              </option>
                            ))}
                          </select>
                        </td>
                      )}
                      <td style={{ padding: "12px 16px", textAlign: "right" }}>
                        <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end", alignItems: "center" }}>
                          {accountTab === "ACTIVE" && (
                            <>
                          <button
                            className="btn btn-primary"
                            onClick={() => handleAssign(patient)}
                            disabled={savingPatientId === patient.id || !selectedDoctors[patient.id]}
                            style={{ height: "36px", padding: "0 14px", marginRight: "8px" }}
                              >
                                {savingPatientId === patient.id ? <div className="spinner spinner-white" style={{ width: "16px", height: "16px" }} /> : "Assign"}
                              </button>
                              <button
                                title="Edit"
                                style={{ background: "none", border: "none", color: "var(--color-text-secondary)", cursor: "pointer", padding: "4px" }}
                                onClick={() => { setEditingPatient(patient); setIsFormOpen(true); }}
                              >
                                <EditIcon />
                              </button>
                            </>
                          )}
                          <button
                            title="Reset password"
                            style={{ background: "none", border: "none", color: "var(--color-text-secondary)", cursor: "pointer", padding: "4px" }}
                            onClick={() => handleResetPassword(patient)}
                          >
                            <KeyIcon />
                          </button>
                          {!patient.archivedAt && (
                            <button
                              title="Archive"
                              style={{ background: "none", border: "none", color: "var(--color-danger)", cursor: "pointer", padding: "4px" }}
                              onClick={() => handleArchive(patient)}
                            >
                              <ArchiveIcon />
                            </button>
                          )}
                          {patient.archivedAt && (
                            <button
                              title="Restore"
                              style={{ background: "none", border: "none", color: "var(--color-text-secondary)", cursor: "pointer", padding: "4px" }}
                              onClick={() => handleRestore(patient)}
                            >
                              <RestoreIcon />
                            </button>
                          )}
                          {patient.archivedAt && (
                            <button
                              title="Delete permanently"
                              style={{ background: "none", border: "none", color: "var(--color-danger)", cursor: "pointer", padding: "4px" }}
                              onClick={() => handlePermanentDelete(patient)}
                            >
                              <TrashIcon />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
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
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(15, 23, 42, 0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 100,
            padding: "20px",
          }}
          onClick={() => setViewingPatient(null)}
        >
          <div
            className="card animate-slide-up"
            style={{ width: "100%", maxWidth: "720px", padding: "24px", maxHeight: "90vh", overflowY: "auto" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px", marginBottom: "20px" }}>
              <div>
                <h2 style={{ fontSize: "22px", fontWeight: 700, margin: "0 0 6px 0", color: "var(--color-text-primary)" }}>
                  {patientName(viewingPatient)}
                </h2>
                <div style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
                  <StatusBadge isActive={viewingPatient.isActive} archivedAt={viewingPatient.archivedAt} />
                  <span style={{ color: "var(--color-text-muted)", fontSize: "14px" }}>{viewingPatient.email}</span>
                </div>
              </div>
              <button
                className="btn btn-secondary"
                style={{ minWidth: "auto", height: "36px", padding: "0 12px" }}
                onClick={() => setViewingPatient(null)}
              >
                Close
              </button>
            </div>

            <h3 style={{ fontSize: "16px", fontWeight: 600, margin: "0 0 16px 0", color: "var(--color-text-primary)" }}>
              Persona Information
            </h3>

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
