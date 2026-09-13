"use client";

import { useEffect, useState } from "react";
import { api, type ApiDoctor, type DoctorProfile, ApiError } from "@/lib/api";
import { StatusBadge } from "@/components/ui/status-badge";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { TemporaryPasswordDialog } from "@/components/ui/temporary-password-dialog";
import { DoctorForm } from "@/components/admin/doctor-form";

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

function doctorName(doctor?: ApiDoctor | null) {
  if (!doctor) return "Doctor";
  const name = [doctor.profile?.firstName, doctor.profile?.lastName].filter(Boolean).join(" ");
  return name ? `Dr. ${name}` : doctor.email;
}

export default function DoctorsPage() {
  const [doctors, setDoctors] = useState<ApiDoctor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("ALL");
  const [accountTab, setAccountTab] = useState<"ACTIVE" | "ARCHIVED">("ACTIVE");

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingDoctor, setEditingDoctor] = useState<ApiDoctor | undefined>(undefined);
  const [formLoading, setFormLoading] = useState(false);
  const [viewingDoctor, setViewingDoctor] = useState<ApiDoctor | null>(null);

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

  const loadDoctors = async () => {
    setLoading(true);
    try {
      const res = await api.getDoctors();
      setDoctors(res.doctors);
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
      else setError("Failed to load doctors");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadDoctors();
  }, []);

  const handleSaveDoctor = async (data: Partial<ApiDoctor & DoctorProfile>) => {
    setFormLoading(true);
    try {
      if (editingDoctor) {
        await api.updateDoctor(editingDoctor.id, data);
      } else {
        const res = await api.createDoctor(data);
        if (res.temporaryPassword) {
          setTempPassword(res.temporaryPassword);
          setIsTempPasswordOpen(true);
        }
      }
      await loadDoctors();
      setIsFormOpen(false);
    } catch (err) {
      if (err instanceof ApiError) alert(err.message);
      else alert("Failed to save doctor");
    } finally {
      setFormLoading(false);
    }
  };

  const handleArchive = (doctor: ApiDoctor) => {
    setConfirmDialog({
      isOpen: true,
      title: "Archive Doctor",
      message: `Are you sure you want to archive Dr. ${doctor.profile?.lastName}? This action cannot be undone fully from the UI.`,
      isDestructive: true,
      isLoading: false,
      action: async () => {
        setConfirmDialog((prev) => ({ ...prev, isLoading: true }));
        try {
          await api.deleteDoctor(doctor.id);
          await loadDoctors();
        } catch (err) {
          if (err instanceof ApiError) alert(err.message);
          else alert("Operation failed");
        } finally {
          setConfirmDialog((prev) => ({ ...prev, isOpen: false, isLoading: false }));
        }
      },
    });
  };

  const handlePermanentDelete = (doctor: ApiDoctor) => {
    setConfirmDialog({
      isOpen: true,
      title: "Delete Doctor Permanently",
      message: `Delete Dr. ${doctor.profile?.lastName || doctor.email} permanently? This will remove the account and related doctor data from the database.`,
      isDestructive: true,
      isLoading: false,
      action: async () => {
        setConfirmDialog((prev) => ({ ...prev, isLoading: true }));
        try {
          await api.permanentlyDeleteDoctor(doctor.id);
          await loadDoctors();
        } catch (err) {
          if (err instanceof ApiError) alert(err.message);
          else alert("Operation failed");
        } finally {
          setConfirmDialog((prev) => ({ ...prev, isOpen: false, isLoading: false }));
        }
      },
    });
  };

  const handleRestore = (doctor: ApiDoctor) => {
    setConfirmDialog({
      isOpen: true,
      title: "Restore Doctor",
      message: `Restore Dr. ${doctor.profile?.lastName || doctor.email} to active use?`,
      isDestructive: false,
      isLoading: false,
      action: async () => {
        setConfirmDialog((prev) => ({ ...prev, isLoading: true }));
        try {
          await api.updateDoctorStatus(doctor.id, true);
          await loadDoctors();
        } catch (err) {
          if (err instanceof ApiError) alert(err.message);
          else alert("Operation failed");
        } finally {
          setConfirmDialog((prev) => ({ ...prev, isOpen: false, isLoading: false }));
        }
      },
    });
  };

  const openDoctorPersona = (doctor: ApiDoctor) => {
    setViewingDoctor(doctor);
  };

  const handleResetPassword = (doctor: ApiDoctor) => {
    const nextPassword = buildGeneratedPassword();
    setConfirmDialog({
      isOpen: true,
      title: "Reset Doctor Password",
      message: `Reset password for Dr. ${doctor.profile?.lastName || doctor.email}? A new temporary password will be shown after reset.`,
      isDestructive: false,
      isLoading: false,
      action: async () => {
        setConfirmDialog((prev) => ({ ...prev, isLoading: true }));
        try {
          await api.resetDoctorPassword(doctor.id, nextPassword);
          setTempPassword(nextPassword);
          setIsTempPasswordOpen(true);
        } catch (err) {
          if (err instanceof ApiError) alert(err.message);
          else alert("Password reset failed");
        } finally {
          setConfirmDialog((prev) => ({ ...prev, isOpen: false, isLoading: false }));
        }
      },
    });
  };

  const filteredDoctors = doctors.filter((d) => {
    const isArchived = Boolean(d.archivedAt);
    const matchesSearch =
      d.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.profile?.firstName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.profile?.lastName?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesTab =
      accountTab === "ARCHIVED" ? isArchived : !isArchived;
    
    const matchesStatus =
      accountTab === "ARCHIVED" ||
      filterStatus === "ALL" ||
      (filterStatus === "ACTIVE" && d.isActive) ||
      (filterStatus === "INACTIVE" && !d.isActive);

    return matchesTab && matchesSearch && matchesStatus;
  });

  const activeAccountCount = doctors.filter((doctor) => !doctor.archivedAt).length;
  const archivedAccountCount = doctors.filter((doctor) => doctor.archivedAt).length;

  return (
    <div className="animate-fade-in" style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <h1 style={{ fontSize: "28px", fontWeight: 700, margin: "0 0 8px 0", color: "var(--color-text-primary)" }}>
            Doctors
          </h1>
          <p style={{ fontSize: "15px", color: "var(--color-text-secondary)", margin: 0 }}>
            Manage doctor accounts and profiles.
          </p>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => {
            setEditingDoctor(undefined);
            setIsFormOpen(true);
          }}
        >
          <PlusIcon /> Add Doctor
        </button>
      </div>

      <div className="card" style={{ padding: "20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "16px", marginBottom: "20px", flexWrap: "wrap" }}>
          <div className="account-tabs" role="tablist" aria-label="Doctor account status">
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

        <div style={{ display: "flex", gap: "16px", marginBottom: "20px", flexWrap: "wrap" }}>
          <input
            type="text"
            className="input"
            placeholder="Search by name or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ maxWidth: "300px" }}
          />
          {accountTab === "ACTIVE" && (
            <select
              className="input"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              style={{ maxWidth: "150px" }}
            >
              <option value="ALL">All Status</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </select>
          )}
        </div>

        {error && (
          <div style={{ padding: "16px", backgroundColor: "#FEF2F2", color: "var(--color-danger)", borderRadius: "var(--radius-md)", marginBottom: "20px" }}>
            {error}
          </div>
        )}

        {loading ? (
          <div style={{ display: "flex", justifyContent: "center", padding: "40px" }}>
            <div className="spinner"></div>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--color-border)", color: "var(--color-text-muted)", fontSize: "14px" }}>
                  <th style={{ padding: "12px 16px", fontWeight: 600 }}>Name</th>
                  <th style={{ padding: "12px 16px", fontWeight: 600 }}>Email</th>
                  <th style={{ padding: "12px 16px", fontWeight: 600 }}>Specialization</th>
                  <th style={{ padding: "12px 16px", fontWeight: 600 }}>Status</th>
                  <th style={{ padding: "12px 16px", fontWeight: 600, textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredDoctors.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ padding: "40px", textAlign: "center", color: "var(--color-text-muted)" }}>
                      {accountTab === "ARCHIVED" ? "No archived doctors found." : "No active doctor accounts found."}
                    </td>
                  </tr>
                ) : (
                  filteredDoctors.map((doctor) => (
                    <tr key={doctor.id} style={{ borderBottom: "1px solid var(--color-page-bg)", transition: "background-color 0.15s ease" }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "var(--color-primary-soft)"} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "transparent"}>
                      <td style={{ padding: "12px 16px", fontWeight: 500, color: "var(--color-text-primary)" }}>
                        <button
                          type="button"
                          onClick={() => openDoctorPersona(doctor)}
                          style={{ color: "var(--color-primary)", textDecoration: "none", background: "none", border: "none", padding: 0, cursor: "pointer", fontWeight: 600, textAlign: "left" }}
                        >
                          {doctor.profile ? `Dr. ${doctor.profile.firstName} ${doctor.profile.lastName}` : "Unknown"}
                        </button>
                      </td>
                      <td style={{ padding: "12px 16px", color: "var(--color-text-secondary)", fontSize: "14px" }}>
                        {doctor.email}
                      </td>
                      <td style={{ padding: "12px 16px", color: "var(--color-text-secondary)", fontSize: "14px" }}>
                        {doctor.profile?.specialization || "-"}
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        <StatusBadge isActive={doctor.isActive} archivedAt={doctor.archivedAt} />
                      </td>
                      <td style={{ padding: "12px 16px", textAlign: "right" }}>
                        <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
                          <button
                            title="Edit"
                            style={{ background: "none", border: "none", color: "var(--color-text-secondary)", cursor: "pointer", padding: "4px" }}
                            onClick={() => { setEditingDoctor(doctor); setIsFormOpen(true); }}
                          >
                            <EditIcon />
                          </button>
                          <button
                            title="Reset password"
                            style={{ background: "none", border: "none", color: "var(--color-text-secondary)", cursor: "pointer", padding: "4px" }}
                            onClick={() => handleResetPassword(doctor)}
                          >
                            <KeyIcon />
                          </button>
                          {!doctor.archivedAt && (
                            <button
                              title="Archive"
                              style={{ background: "none", border: "none", color: "var(--color-danger)", cursor: "pointer", padding: "4px" }}
                              onClick={() => handleArchive(doctor)}
                            >
                              <ArchiveIcon />
                            </button>
                          )}
                          {doctor.archivedAt && (
                            <button
                              title="Restore"
                              style={{ background: "none", border: "none", color: "var(--color-text-secondary)", cursor: "pointer", padding: "4px" }}
                              onClick={() => handleRestore(doctor)}
                            >
                              <RestoreIcon />
                            </button>
                          )}
                          {doctor.archivedAt && (
                            <button
                              title="Delete permanently"
                              style={{ background: "none", border: "none", color: "var(--color-danger)", cursor: "pointer", padding: "4px" }}
                              onClick={() => handlePermanentDelete(doctor)}
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

      <DoctorForm
        isOpen={isFormOpen}
        initialData={editingDoctor}
        onSave={handleSaveDoctor}
        onCancel={() => setIsFormOpen(false)}
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

      {viewingDoctor && (
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
          onClick={() => setViewingDoctor(null)}
        >
          <div
            className="card animate-slide-up"
            style={{ width: "100%", maxWidth: "720px", padding: "24px", maxHeight: "90vh", overflowY: "auto" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px", marginBottom: "20px" }}>
              <div>
                <h2 style={{ fontSize: "22px", fontWeight: 700, margin: "0 0 6px 0", color: "var(--color-text-primary)" }}>
                  {doctorName(viewingDoctor)}
                </h2>
                <div style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
                  <StatusBadge isActive={viewingDoctor.isActive} archivedAt={viewingDoctor.archivedAt} />
                  <span style={{ color: "var(--color-text-muted)", fontSize: "14px" }}>{viewingDoctor.email}</span>
                </div>
              </div>
              <button
                className="btn btn-secondary"
                style={{ minWidth: "auto", height: "36px", padding: "0 12px" }}
                onClick={() => setViewingDoctor(null)}
              >
                Close
              </button>
            </div>

            <h3 style={{ fontSize: "16px", fontWeight: 600, margin: "0 0 16px 0", color: "var(--color-text-primary)" }}>
              Persona Information
            </h3>

            <div className="doctor-form-grid">
              <DetailField label="First Name" value={viewingDoctor.profile?.firstName} />
              <DetailField label="Last Name" value={viewingDoctor.profile?.lastName} />
              <DetailField label="Specialization" value={viewingDoctor.profile?.specialization} />
              <DetailField label="License Number" value={viewingDoctor.profile?.licenseNumber} />
              <DetailField label="Contact Number" value={viewingDoctor.profile?.contactNumber} />
              <DetailField label="Clinic Schedule" value={viewingDoctor.profile?.clinicSchedule} />
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
