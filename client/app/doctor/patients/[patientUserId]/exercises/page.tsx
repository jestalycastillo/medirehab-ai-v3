"use client";

import { PortalPage, PortalPageHeader } from "@/components/ui/portal-page";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { api, ApiError, type ApiExercise, type ApiPatient, type AssignmentPlanUpdate, type ExerciseAssignment } from "@/lib/api";
import { ExerciseAssignmentList } from "@/components/doctor/exercise-assignment-list";
import { ExercisePicker } from "@/components/doctor/exercise-picker";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { CheckCircle2, CircleAlert, X } from "lucide-react";

function patientName(patient?: ApiPatient | null) {
  if (!patient) return "Patient";
  return [patient.profile?.firstName, patient.profile?.lastName].filter(Boolean).join(" ") || patient.email;
}

function AddExercisesDrawer({
  open,
  onClose,
  exercises,
  onAssign,
  isBusy,
}: {
  open: boolean;
  onClose: () => void;
  exercises: ApiExercise[];
  onAssign: (exerciseId: string) => void;
  isBusy: boolean;
}) {
  if (!open) return null;
  return (
    <>
      <button type="button" className="doctor-care-drawer-backdrop" onClick={onClose} aria-label="Close available exercises" />
      <aside className="doctor-care-drawer" role="dialog" aria-labelledby="add-exercises-drawer-title">
        <header className="doctor-care-drawer-heading">
          <div>
            <span>Care plan</span>
            <h2 id="add-exercises-drawer-title">Add exercises</h2>
          </div>
          <button type="button" className="doctor-care-drawer-close" onClick={onClose} aria-label="Close available exercises">
            <X aria-hidden="true" />
          </button>
        </header>
        <div className="doctor-care-drawer-content">
          <p className="doctor-care-drawer-description">Choose movements to add to this patient’s care plan.</p>
          <ExercisePicker exercises={exercises} onAssign={onAssign} isBusy={isBusy} />
        </div>
      </aside>
    </>
  );
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
  const [actionError, setActionError] = useState("");
  const [success, setSuccess] = useState("");
  const [isAddingExercises, setIsAddingExercises] = useState(false);
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
    setActionError("");
    try {
      await api.assignExercise(patientUserId, exerciseId);
      await loadData();
      setSuccess("Exercise assigned.");
    } catch (err) {
      setSuccess("");
      setActionError(err instanceof ApiError ? err.message : "Failed to assign exercise.");
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = (assignment: ExerciseAssignment) => {
    setActionError("");
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
          setSuccess("Exercise removed from the care plan.");
        } catch (err) {
          setSuccess("");
          setActionError(err instanceof ApiError ? err.message : "Failed to remove assignment.");
        } finally {
          setBusy(false);
          setConfirmDialog((prev) => ({ ...prev, isOpen: false, isLoading: false }));
        }
      },
    });
  };

  const handleUpdatePlan = async (assignmentId: string, data: AssignmentPlanUpdate) => {
    setBusy(true);
    setActionError("");
    try {
      await api.updateAssignmentPlan(patientUserId, assignmentId, data);
      await loadData();
      setSuccess("Care plan updated.");
      return true;
    } catch (err) {
      setSuccess("");
      setActionError(err instanceof ApiError ? err.message : "Failed to update care plan.");
      return false;
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <div className="role-dashboard-loading" role="status"><div className="spinner" aria-hidden="true" />Loading care plan…</div>;

  if (error) {
    return (
      <div className="card" role="alert" style={{ padding: "24px", borderColor: "var(--color-danger)", backgroundColor: "var(--color-danger-surface)" }}>
        <h1 style={{ fontSize: "20px", color: "var(--color-danger)", margin: "0 0 8px 0" }}>Unable to load assignments</h1>
        <p style={{ margin: "0 0 16px 0", color: "var(--color-text-secondary)" }}>{error}</p>
        <Link className="btn btn-secondary" href="/doctor/patients">Back to patients</Link>
      </div>
    );
  }

  return (
    <PortalPage>
      <PortalPageHeader title={`${patientName(patient)}’s care plan`} eyebrow="Doctor / Care plan" description="Review prescribed exercises, adjust goals, and add movements to the plan." back={<Link className="care-page-back" href={`/doctor/patients/${patientUserId}`}>Back to patient</Link>} />

      {actionError && <div className="admin-feedback admin-feedback-error" role="alert"><CircleAlert aria-hidden="true" />{actionError}</div>}
      {success && <div className="admin-feedback admin-feedback-success" role="status"><CheckCircle2 aria-hidden="true" />{success}</div>}

      <ExerciseAssignmentList assignments={assignedExercises} onRemove={handleRemove} onUpdatePlan={handleUpdatePlan} isBusy={busy} />
      <button type="button" className="btn btn-primary doctor-add-exercises-button" onClick={() => setIsAddingExercises(true)}>
        Add exercises <span>{availableExercises.length} available</span>
      </button>
      <AddExercisesDrawer open={isAddingExercises} onClose={() => setIsAddingExercises(false)} exercises={availableExercises} onAssign={handleAssign} isBusy={busy} />

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
    </PortalPage>
  );
}
