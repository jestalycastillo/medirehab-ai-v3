"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { api, ApiError, type ApiPatient, type ExerciseAssignment } from "@/lib/api";
import { StatusBadge } from "@/components/ui/status-badge";
import { CircleAlert } from "lucide-react";
import { PortalPage, PortalPageHeader } from "@/components/ui/portal-page";

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
    <PortalPage className="care-page">
      <PortalPageHeader title="Care plans" eyebrow="Doctor / Care plans" description="Find a patient, then review or adjust their prescribed exercises." />
      <section className="card care-page-panel">
        <div className="admin-directory-toolbar">
          <div className="portal-list-copy"><h3>Patient plans</h3><p>Assignments are managed within each patient’s record.</p></div>
          <input type="search" className="input" aria-label="Search patients by name or email" placeholder="Search patient name or email" value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} />
        </div>
        {error && <div className="admin-feedback admin-feedback-error" role="alert"><CircleAlert aria-hidden="true" />{error}</div>}
        {!loading && <p className="admin-directory-result-count" role="status">Showing {filteredPatients.length} patient{filteredPatients.length === 1 ? "" : "s"}.</p>}
        {loading ? (
          <div className="admin-directory-loading" role="status"><div className="spinner" aria-hidden="true" />Loading care plans…</div>
        ) : filteredPatients.length === 0 ? (
          <div className="care-page-empty" role="status"><strong>{searchTerm ? "No matching patients" : "No patients assigned yet"}</strong>{searchTerm && <button type="button" className="btn btn-secondary" onClick={() => setSearchTerm("")}>Clear search</button>}</div>
        ) : (
          <div className="portal-care-plans">
            {filteredPatients.map((patient) => (
              <div className="portal-list-row" key={patient.id}>
                <div className="portal-list-copy"><h3><Link className="directory-person-link" href={`/doctor/patients/${patient.id}`}>{patientName(patient)}</Link></h3><p>{patient.email}</p><p>{assignmentCounts[patient.id] ?? 0} prescribed exercise{(assignmentCounts[patient.id] ?? 0) === 1 ? "" : "s"}</p></div>
                <div className="portal-list-actions"><StatusBadge isActive={patient.isActive} archivedAt={patient.archivedAt} /><Link className="btn btn-secondary" href={`/doctor/patients/${patient.id}/exercises`}>Open care plan</Link></div>
              </div>
            ))}
          </div>
        )}
      </section>
    </PortalPage>
  );
}
