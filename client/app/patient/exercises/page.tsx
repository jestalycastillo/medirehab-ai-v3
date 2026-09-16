"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, CircleAlert, FileText, History, LoaderCircle, Search } from "lucide-react";
import { api, ApiError, type CareSession, type ExerciseAssignment, type PatientProfile } from "@/lib/api";
import { MyExerciseList } from "@/components/patient/my-exercise-list";
import { CareTimeline } from "@/components/care/care-timeline";
import { ScoreSummary } from "@/components/care/score-summary";
import { HelpRequestPanel } from "@/components/care/help-request-panel";
import { ProgressReport } from "@/components/care/progress-report";
import { Card, CardContent, CardDescription, CardTitle } from "@/components/ui/card";

export default function PatientExercisesPage() {
  const [assignments, setAssignments] = useState<ExerciseAssignment[]>([]);
  const [sessions, setSessions] = useState<CareSession[]>([]);
  const [patientName, setPatientName] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    let mounted = true;

    async function loadExercises() {
      try {
        const [assignedRes, sessionsRes, profileRes] = await Promise.all([
          api.getMyAssignedExercises(),
          api.getMySessions(),
          api.getProfile().catch(() => null),
        ]);
        if (mounted) {
          setAssignments(assignedRes.assignments);
          setSessions(sessionsRes.sessions);
          if (profileRes?.user?.profile) {
            const profile = profileRes.user.profile as PatientProfile;
            const full = `${profile.firstName || ""} ${profile.lastName || ""}`.trim();
            if (full) setPatientName(full);
          }
          void api.markExercisesViewed(assignedRes.assignments.map((assignment) => assignment.id)).catch(() => undefined);
        }
      } catch (err) {
        if (mounted) setError(err instanceof ApiError ? err.message : "Failed to load assigned exercises.");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadExercises();
    return () => { mounted = false; };
  }, []);

  const filteredAssignments = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return assignments;
    return assignments.filter((assignment) => assignment.exercise?.name?.toLowerCase().includes(query) || assignment.exercise?.description?.toLowerCase().includes(query));
  }, [assignments, searchTerm]);

  return (
    <div className="patient-page patient-exercises-page animate-fade-in">
      <header className="patient-page-header">
        <div><span className="patient-page-eyebrow">Your care plan</span><h1>My exercises</h1></div>
        {assignments.length > 3 && (
          <label className="patient-search"><Search /><span className="sr-only">Search exercises</span><input type="search" placeholder="Find an exercise" value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} /></label>
        )}
      </header>

      {error && <div className="patient-page-alert" role="alert"><CircleAlert /><span>{error}</span></div>}

      {loading ? (
        <div className="patient-page-loading"><LoaderCircle className="recorder-spin" /><span>Loading your exercises…</span></div>
      ) : <MyExerciseList assignments={filteredAssignments} />}

      {!loading && assignments.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <details className="patient-page-disclosure no-print">
            <summary><span><History /><span><strong>Past sessions & score progress</strong></span></span><ChevronDown /></summary>
            <div className="patient-page-disclosure-content">
              <ScoreSummary sessions={sessions} />
              <Card><CardContent className="patient-history-content"><CardTitle>Past sessions</CardTitle><CardDescription>{sessions.length} session{sessions.length === 1 ? "" : "s"} recorded</CardDescription><CareTimeline sessions={sessions} role="patient" /></CardContent></Card>
            </div>
          </details>

          <details className="patient-page-disclosure progress-report-disclosure">
            <summary><span><FileText /><span><strong>Patient Rehabilitation Progress Report</strong></span></span><ChevronDown /></summary>
            <div className="patient-page-disclosure-content">
              <ProgressReport sessions={sessions} assignments={assignments} subjectName={patientName || "My Rehabilitation Progress"} />
            </div>
          </details>
        </div>
      )}

      {!loading && <div className="patient-help-wrap"><HelpRequestPanel assignments={assignments} /></div>}
    </div>
  );
}
