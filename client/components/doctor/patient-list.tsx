"use client";

import Link from "next/link";
import { type ApiPatient } from "@/lib/api";
import { StatusBadge } from "@/components/ui/status-badge";

function patientName(patient: ApiPatient) {
  const name = [patient.profile?.firstName, patient.profile?.lastName].filter(Boolean).join(" ");
  return name || "Unnamed patient";
}

export function PatientList({
  patients,
  onEdit,
  onToggleStatus,
  onArchive,
  onResetPassword,
  emptyMessage = "No patients found.",
}: {
  patients: ApiPatient[];
  onEdit: (patient: ApiPatient) => void;
  onToggleStatus: (patient: ApiPatient) => void;
  onArchive: (patient: ApiPatient) => void;
  onResetPassword: (patient: ApiPatient) => void;
  emptyMessage?: string;
}) {
  if (patients.length === 0) {
    return (
      <div style={{ padding: "40px", textAlign: "center", color: "var(--color-text-muted)" }}>
        {emptyMessage}
      </div>
    );
  }

  return (
    <>
      <div className="doctor-table-wrap" style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--color-border)", color: "var(--color-text-muted)", fontSize: "14px" }}>
              <th style={{ padding: "12px 16px", fontWeight: 600 }}>Patient</th>
              <th style={{ padding: "12px 16px", fontWeight: 600 }}>Email</th>
              <th style={{ padding: "12px 16px", fontWeight: 600 }}>Condition</th>
              <th style={{ padding: "12px 16px", fontWeight: 600 }}>Status</th>
              <th style={{ padding: "12px 16px", fontWeight: 600, textAlign: "right" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {patients.map((patient) => (
              <tr key={patient.id} style={{ borderBottom: "1px solid var(--color-page-bg)" }}>
                <td style={{ padding: "12px 16px", fontWeight: 600 }}>
                  <Link href={`/doctor/patients/${patient.id}`} style={{ color: "var(--color-primary)", textDecoration: "none" }}>
                    {patientName(patient)}
                  </Link>
                </td>
                <td style={{ padding: "12px 16px", color: "var(--color-text-secondary)", fontSize: "14px" }}>{patient.email}</td>
                <td style={{ padding: "12px 16px", color: "var(--color-text-secondary)", fontSize: "14px" }}>{patient.profile?.medicalCondition || "-"}</td>
                <td style={{ padding: "12px 16px" }}><StatusBadge isActive={patient.isActive} archivedAt={patient.archivedAt} /></td>
                <td style={{ padding: "12px 16px" }}>
                  <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end", flexWrap: "wrap" }}>
                    <Link className="btn btn-secondary" href={`/doctor/patients/${patient.id}/exercises`} style={{ height: "34px", padding: "0 12px", fontSize: "13px" }}>
                      Assign
                    </Link>
                    <button className="btn btn-secondary" onClick={() => onEdit(patient)} style={{ height: "34px", padding: "0 12px", fontSize: "13px" }}>Edit</button>
                    <button className="btn btn-secondary" onClick={() => onResetPassword(patient)} style={{ height: "34px", padding: "0 12px", fontSize: "13px" }}>Reset</button>
                    <button className="btn btn-secondary" onClick={() => onToggleStatus(patient)} style={{ height: "34px", padding: "0 12px", fontSize: "13px" }}>
                      {patient.isActive ? "Deactivate" : "Activate"}
                    </button>
                    {!patient.archivedAt && (
                      <button className="btn btn-danger" onClick={() => onArchive(patient)} style={{ height: "34px", padding: "0 12px", fontSize: "13px" }}>
                        Archive
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ flexDirection: "column", gap: "12px" }} className="doctor-list-card">
        {patients.map((patient) => (
          <div key={patient.id} style={{ border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", padding: "16px", display: "flex", flexDirection: "column", gap: "12px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px" }}>
              <div>
                <Link href={`/doctor/patients/${patient.id}`} style={{ color: "var(--color-primary)", textDecoration: "none", fontWeight: 700 }}>
                  {patientName(patient)}
                </Link>
                <div style={{ color: "var(--color-text-muted)", fontSize: "13px" }}>{patient.email}</div>
              </div>
              <StatusBadge isActive={patient.isActive} archivedAt={patient.archivedAt} />
            </div>
            <div style={{ color: "var(--color-text-secondary)", fontSize: "14px" }}>{patient.profile?.medicalCondition || "No condition recorded."}</div>
            <div className="responsive-actions">
              <Link className="btn btn-primary" href={`/doctor/patients/${patient.id}/exercises`} style={{ height: "38px" }}>Assign Exercise</Link>
              <button className="btn btn-secondary" onClick={() => onEdit(patient)} style={{ height: "38px" }}>Edit</button>
              <button className="btn btn-secondary" onClick={() => onResetPassword(patient)} style={{ height: "38px" }}>Reset</button>
              <button className="btn btn-secondary" onClick={() => onToggleStatus(patient)} style={{ height: "38px" }}>{patient.isActive ? "Deactivate" : "Activate"}</button>
              {!patient.archivedAt && <button className="btn btn-danger" onClick={() => onArchive(patient)} style={{ height: "38px" }}>Archive</button>}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
