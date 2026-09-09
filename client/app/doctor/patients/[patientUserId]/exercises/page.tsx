"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { api, ApiError, type ApiExercise, type ApiPatient, type ExerciseAssignment } from "@/lib/api";
import { ExerciseAssignmentList } from "@/components/doctor/exercise-assignment-list";
import { ExercisePicker } from "@/components/doctor/exercise-picker";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

function patientName(patient?: ApiPatient | null) {
  if (!patient) return "Patient";
  return [patient.profile?.firstName, patient.profile?.lastName].filter(Boolean).join(" ") || patient.email;
}

export default function PatientExercisesPage() {
  const params = useParams<{ patientUserId: string }>();
  const patientUserId = params.patientUserId;
  const [patient, setPatient] = useState<ApiPatient | null>(null);
  const [availableExercises, setAvailableExercises] = useState<ApiExercise[]>([]);
  const [assignedExercises, setAssignedExercises] = useState<ExerciseAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [confirmDialog, setConfirmDialog] = useState({
    isOpen: false,
    title: "",
    message: "",
    isLoading: false,
    action: async () => {},
  });

  const loadData = async () => {
    setError("");
    try {
      const [patientRes, availableRes, assignedRes] = await Promise.all([
        api.getPatient(patientUserId),
        api.getAvailableExercises(patientUserId),
        api.getAssignedExercises(patientUserId),
      ]);
      setPatient(patientRes.patient);
      setAvailableExercises(availableRes.exercises);
      setAssignedExercises(assignedRes.assignments);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load exercise assignments.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientUserId]);

  const handleAssign = async (exerciseId: string) => {
    setBusy(true);
    try {
      await api.assignExercise(patientUserId, exerciseId);
      await loadData();
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Failed to assign exercise.");
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = (assignment: ExerciseAssignment) => {
    setConfirmDialog({
      isOpen: true,
      title: "Remove Assignment",
      message: `Remove ${assignment.exercise?.name || "this exercise"} from ${patientName(patient)}?`,
      isLoading: false,
      action: async () => {
        setConfirmDialog((prev) => ({ ...prev, isLoading: true }));
        setBusy(true);
        try {
          await api.removeAssignedExercise(patientUserId, assignment.id);
          await loadData();
        } catch (err) {
          alert(err instanceof ApiError ? err.message : "Failed to remove assignment.");
        } finally {
          setBusy(false);
          setConfirmDialog((prev) => ({ ...prev, isOpen: false, isLoading: false }));
        }
      },
    });
  };

  const handleUpdatePlan = async (assignmentId: string, data: { targetSessionsPerWeek: number; dueDate?: string | null; reviewDate?: string | null; doctorInstructions?: string | null }) => {
    setBusy(true);
    try {
      await api.updateAssignmentPlan(patientUserId, assignmentId, data);
      await loadData();
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Failed to update care plan.");
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <div style={{ display: "flex", justifyContent: "center", padding: "80px" }}><div className="spinner" /></div>;

  if (error) {
    return (
      <div className="card" style={{ padding: "24px", borderColor: "var(--color-danger)", backgroundColor: "#FEF2F2" }}>
        <h1 style={{ fontSize: "20px", color: "var(--color-danger)", margin: "0 0 8px 0" }}>Unable to load assignments</h1>
        <p style={{ margin: "0 0 16px 0", color: "var(--color-text-secondary)" }}>{error}</p>
        <Link className="btn btn-secondary" href="/doctor/patients">Back to patients</Link>
      </div>
    );
  }

  return (
    <div className="animate-fade-in" style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      <div>
        <Link href={`/doctor/patients/${patientUserId}`} style={{ color: "var(--color-primary)", textDecoration: "none", fontWeight: 600, fontSize: "14px" }}>
          Back to patient
        </Link>
        <h1 style={{ fontSize: "28px", fontWeight: 700, margin: "8px 0" }}>Exercise Assignments</h1>
        <p style={{ color: "var(--color-text-secondary)", margin: 0 }}>
          Manage rehabilitation exercises for {patientName(patient)}.
        </p>
      </div>

      <section className="doctor-two-column">
        <ExercisePicker exercises={availableExercises} onAssign={handleAssign} isBusy={busy} />
        <ExerciseAssignmentList assignments={assignedExercises} onRemove={handleRemove} onUpdatePlan={handleUpdatePlan} isBusy={busy} />
      </section>

      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        confirmLabel="Remove"
        isDestructive
        isLoading={confirmDialog.isLoading}
        onConfirm={confirmDialog.action}
        onCancel={() => setConfirmDialog((prev) => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
}
