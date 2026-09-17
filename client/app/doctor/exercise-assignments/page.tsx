"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { api, ApiError, type ApiPatient, type ExerciseAssignment } from "@/lib/api";
import { StatusBadge } from "@/components/ui/status-badge";
import { CircleAlert } from "lucide-react";

function patientName(patient: ApiPatient) {
  return [patient.profile?.firstName, patient.profile?.lastName].filter(Boolean).join(" ") || patient.email;
}

export default function DoctorExerciseAssignmentsPage() {
  const [patients, setPatients] = useState<ApiPatient[]>([]);
  const [assignmentCounts, setAssignmentCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    let mounted = true;

    async function loadData() {
      try {
        const patientsRes = await api.getPatients();
        const entries = await Promise.all(
          patientsRes.patients.map(async (patient) => {
            try {
              const res: { assignments: ExerciseAssignment[] } = await api.getAssignedExercises(patient.id);
              return [patient.id, res.assignments.length] as const;
            } catch {
              return [patient.id, 0] as const;
            }
          })
        );
        if (mounted) {
          setPatients(patientsRes.patients);
          setAssignmentCounts(Object.fromEntries(entries));
        }
      } catch (err) {
        if (mounted) setError(err instanceof ApiError ? err.message : "Failed to load patients.");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadData();
    return () => {
      mounted = false;
    };
  }, []);

  const filteredPatients = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return patients.filter((patient) => {
      if (!query) return true;
      return (
        patient.email.toLowerCase().includes(query) ||
        patient.profile?.firstName?.toLowerCase().includes(query) ||
        patient.profile?.lastName?.toLowerCase().includes(query)
      );
    });
  }, [patients, searchTerm]);

  return (
    <div className="role-dashboard care-page animate-fade-in">
      <header className="role-dashboard-header">
        <div>
          <span className="role-dashboard-eyebrow">Doctor / Exercises</span>
          <h1>Exercise assignments</h1>
          <p>Select a patient to assign or review rehabilitation exercises.</p>
        </div>
      </header>

      <div className="card care-page-panel">
        <div className="doctor-toolbar care-page-toolbar">
          <input
            type="text"
            className="input"
            aria-label="Search patients by name or email"
            placeholder="Search patient name or email"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            style={{ maxWidth: "340px" }}
          />
        </div>

        {error && <div className="admin-feedback admin-feedback-error" role="alert"><CircleAlert aria-hidden="true" />{error}</div>}
        {!loading && <p className="admin-directory-result-count" role="status">Showing {filteredPatients.length} patient{filteredPatients.length === 1 ? "" : "s"}{searchTerm.trim() ? " matching your search" : ""}.</p>}

        {loading ? (
          <div className="admin-directory-loading" role="status"><div className="spinner" aria-hidden="true" />Loading patients…</div>
        ) : filteredPatients.length === 0 ? (
          <div className="care-page-empty" role="status">{searchTerm ? <><strong>No patients match your search.</strong><button type="button" className="btn btn-secondary" onClick={() => setSearchTerm("")}>Clear search</button></> : "No patients assigned yet."}</div>
        ) : (
          <div className="care-assignment-grid">
            {filteredPatients.map((patient) => (
              <div className="care-assignment-card" key={patient.id}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "flex-start" }}>
                  <div>
                    <div style={{ fontWeight: 700 }}>{patientName(patient)}</div>
                    <div style={{ color: "var(--color-text-muted)", fontSize: "13px" }}>{patient.email}</div>
                  </div>
                  <StatusBadge isActive={patient.isActive} archivedAt={patient.archivedAt} />
                </div>
                <div style={{ color: "var(--color-text-secondary)", fontSize: "14px" }}>
                  {assignmentCounts[patient.id] ?? 0} assigned exercise{(assignmentCounts[patient.id] ?? 0) === 1 ? "" : "s"}
                </div>
                <Link className="btn btn-primary btn-full" href={`/doctor/patients/${patient.id}/exercises`}>
                  Manage Assignments
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
