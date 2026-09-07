"use client";

import { useEffect, useState } from "react";
import { api, type ApiExercise, ApiError, type ExerciseImage } from "@/lib/api";
import { StatusBadge } from "@/components/ui/status-badge";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ExerciseForm } from "@/components/admin/exercise-form";

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

function ActiveExercisesIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <polyline points="16 11 18 13 22 9" />
    </svg>
  );
}

export default function ExercisesPage() {
  const [exercises, setExercises] = useState<ApiExercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [accountTab, setAccountTab] = useState<"ACTIVE" | "ARCHIVED">("ACTIVE");

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingExercise, setEditingExercise] = useState<ApiExercise | undefined>(undefined);
  const [viewingExercise, setViewingExercise] = useState<ApiExercise | undefined>(undefined);
  const [formLoading, setFormLoading] = useState(false);

  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    action: () => Promise<void>;
    isLoading: boolean;
  }>({
    isOpen: false,
    title: "",
    message: "",
    action: async () => {},
    isLoading: false,
  });

  const loadExercises = async () => {
    setLoading(true);
    try {
      const res = await api.getExercises();
      setExercises(res.exercises);
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
      else setError("Failed to load exercises");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadExercises();
  }, []);

  const handleSaveExercise = async (data: { name: string; description: string; images: ExerciseImage[] }) => {
    setFormLoading(true);
    try {
      if (editingExercise) {
        await api.updateExercise(editingExercise.id, data);
      } else {
        await api.createExercise({ ...data, exercise: data.name });
      }
      await loadExercises();
      setIsFormOpen(false);
      setEditingExercise(undefined);
    } catch (err) {
      if (err instanceof ApiError) alert(err.message);
      else alert("Failed to save exercise");
    } finally {
      setFormLoading(false);
    }
  };

  const handleArchive = (exercise: ApiExercise) => {
    setConfirmDialog({
      isOpen: true,
      title: "Archive Exercise",
      message: `Are you sure you want to archive "${exercise.name}"?`,
      isLoading: false,
      action: async () => {
        setConfirmDialog((prev) => ({ ...prev, isLoading: true }));
        try {
          await api.deleteExercise(exercise.id);
          await loadExercises();
        } catch (err) {
          if (err instanceof ApiError) alert(err.message);
          else alert("Operation failed");
        } finally {
          setConfirmDialog((prev) => ({ ...prev, isOpen: false, isLoading: false }));
        }
      },
    });
  };

  const handlePermanentDelete = (exercise: ApiExercise) => {
    setConfirmDialog({
      isOpen: true,
      title: "Delete Exercise Permanently",
      message: `Delete "${exercise.name}" permanently? This will remove the exercise and all related images, assignments, and session history.`,
      isLoading: false,
      action: async () => {
        setConfirmDialog((prev) => ({ ...prev, isLoading: true }));
        try {
          await api.permanentlyDeleteExercise(exercise.id);
          await loadExercises();
        } catch (err) {
          if (err instanceof ApiError) alert(err.message);
          else alert("Operation failed");
        } finally {
          setConfirmDialog((prev) => ({ ...prev, isOpen: false, isLoading: false }));
        }
      },
    });
  };

  const handleRestore = (exercise: ApiExercise) => {
    setConfirmDialog({
      isOpen: true,
      title: "Restore Exercise",
      message: `Restore "${exercise.name}" to active use?`,
      isLoading: false,
      action: async () => {
        setConfirmDialog((prev) => ({ ...prev, isLoading: true }));
        try {
          await api.restoreExercise(exercise.id);
          await loadExercises();
        } catch (err) {
          if (err instanceof ApiError) alert(err.message);
          else alert("Operation failed");
        } finally {
          setConfirmDialog((prev) => ({ ...prev, isOpen: false, isLoading: false }));
        }
      },
    });
  };

  const activeAccountCount = exercises.filter((exercise) => !exercise.archivedAt).length;
  const archivedAccountCount = exercises.filter((exercise) => exercise.archivedAt).length;
  const filteredExercises = exercises.filter((exercise) => {
    const isArchived = Boolean(exercise.archivedAt);
    const matchesTab = accountTab === "ARCHIVED" ? isArchived : !isArchived;
    const matchesSearch = (exercise.name || exercise.id).toLowerCase().includes(searchTerm.toLowerCase());

    return matchesTab && matchesSearch;
  });

  return (
    <div className="animate-fade-in" style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <h1 style={{ fontSize: "28px", fontWeight: 700, margin: "0 0 8px 0", color: "var(--color-text-primary)" }}>
            Exercises
          </h1>
          <p style={{ fontSize: "15px", color: "var(--color-text-secondary)", margin: 0 }}>
            Manage the platform&apos;s exercise catalog.
          </p>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => {
            setEditingExercise(undefined);
            setIsFormOpen(true);
          }}
        >
          <PlusIcon /> Add Exercise
        </button>
      </div>

      <div className="card" style={{ padding: "20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "16px", marginBottom: "20px", flexWrap: "wrap" }}>
          <div className="account-tabs" role="tablist" aria-label="Exercise account status">
            <button
              type="button"
              className={`account-tab ${accountTab === "ACTIVE" ? "account-tab-active" : ""}`}
              onClick={() => setAccountTab("ACTIVE")}
              role="tab"
              aria-selected={accountTab === "ACTIVE"}
              aria-label={`Active exercises, ${activeAccountCount}`}
              title="Active exercises"
            >
              <ActiveExercisesIcon />
              <span className="account-tab-count">{activeAccountCount}</span>
            </button>
            <button
              type="button"
              className={`account-tab ${accountTab === "ARCHIVED" ? "account-tab-active" : ""}`}
              onClick={() => setAccountTab("ARCHIVED")}
              role="tab"
              aria-selected={accountTab === "ARCHIVED"}
              aria-label={`Archived exercises, ${archivedAccountCount}`}
              title="Archived exercises"
            >
              <ArchiveIcon />
              <span className="account-tab-count">{archivedAccountCount}</span>
            </button>
          </div>

          <input
            type="text"
            className="input"
            placeholder="Search by name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ maxWidth: "300px" }}
          />
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
          <div>
            {filteredExercises.length === 0 ? (
              <div style={{ padding: "40px", textAlign: "center", color: "var(--color-text-muted)", border: "1px dashed var(--color-border)", borderRadius: "var(--radius-lg)" }}>
                {accountTab === "ARCHIVED" ? "No archived exercises found." : "No active exercises found."}
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(285px, 1fr))", gap: "20px" }}>
                {filteredExercises.map((exercise) => {
                  const mainImage = exercise.images && exercise.images.length > 0 ? exercise.images[0].filepath : null;
                  return (
                    <div
                      key={exercise.id}
                      className="card"
                      style={{ display: "flex", flexDirection: "column", overflow: "hidden", border: "1px solid var(--color-border)", padding: 0, cursor: "pointer", transition: "transform 0.15s ease, box-shadow 0.15s ease" }}
                      onClick={() => setViewingExercise(exercise)}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = "translateY(-2px)";
                        e.currentTarget.style.boxShadow = "var(--shadow-md)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = "translateY(0)";
                        e.currentTarget.style.boxShadow = "none";
                      }}
                    >
                      <div style={{ height: "160px", backgroundColor: "var(--color-page-bg)", position: "relative", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", borderBottom: "1px solid var(--color-border)" }}>
                        {mainImage ? (
                          <img
                            src={mainImage}
                            alt={exercise.name}
                            style={{ width: "100%", height: "100%", objectFit: "cover" }}
                            onError={(e) => {
                              e.currentTarget.style.display = "none";
                              const fallbackParent = e.currentTarget.parentElement;
                              if (fallbackParent) {
                                const placeholderEl = fallbackParent.querySelector(".fallback-placeholder");
                                if (placeholderEl) (placeholderEl as HTMLElement).style.display = "flex";
                              }
                            }}
                          />
                        ) : null}
                        <div
                          className="fallback-placeholder"
                          style={{
                            display: mainImage ? "none" : "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            color: "var(--color-text-muted)",
                          }}
                        >
                          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                            <path d="M6.5 6.5h11M6.5 17.5h11M3 12h18M6.5 6.5v11M17.5 6.5v11" />
                          </svg>
                          <span style={{ fontSize: "12px", marginTop: "8px" }}>No image</span>
                        </div>
                        <div style={{ position: "absolute", top: "12px", right: "12px" }}>
                          <StatusBadge isActive={!exercise.archivedAt} archivedAt={exercise.archivedAt} />
                        </div>
                      </div>
                      <div style={{ padding: "16px", display: "flex", flexDirection: "column", flex: 1 }}>
                        <h3 style={{ fontSize: "18px", fontWeight: 600, margin: "0 0 8px 0", color: "var(--color-text-primary)" }}>
                          {exercise.name || exercise.id}
                        </h3>
                        <p style={{ fontSize: "14px", color: "var(--color-text-secondary)", margin: "0 0 16px 0", flex: 1, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden", textOverflow: "ellipsis", minHeight: "60px" }}>
                          {exercise.description || "-"}
                        </p>
                        <div style={{ display: "flex", justifyContent: "flex-end", borderTop: "1px solid var(--color-page-bg)", paddingTop: "12px", marginTop: "auto" }}>
                          <div style={{ display: "flex", gap: "8px" }}>
                            <button
                              title="Edit"
                              style={{ background: "none", border: "none", color: "var(--color-text-secondary)", cursor: "pointer", padding: "4px" }}
                              onClick={(e) => { e.stopPropagation(); setEditingExercise(exercise); setIsFormOpen(true); }}
                            >
                              <EditIcon />
                            </button>
                            {accountTab === "ACTIVE" && !exercise.archivedAt && (
                              <button
                                title="Archive"
                                style={{ background: "none", border: "none", color: "var(--color-danger)", cursor: "pointer", padding: "4px" }}
                                onClick={(e) => { e.stopPropagation(); handleArchive(exercise); }}
                              >
                                <ArchiveIcon />
                              </button>
                            )}
                            {accountTab === "ARCHIVED" && exercise.archivedAt && (
                              <button
                                title="Restore"
                                style={{ background: "none", border: "none", color: "var(--color-text-secondary)", cursor: "pointer", padding: "4px" }}
                                onClick={(e) => { e.stopPropagation(); handleRestore(exercise); }}
                              >
                                <RestoreIcon />
                              </button>
                            )}
                            {accountTab === "ARCHIVED" && exercise.archivedAt && (
                              <button
                                title="Delete permanently"
                                style={{ background: "none", border: "none", color: "var(--color-danger)", cursor: "pointer", padding: "4px" }}
                                onClick={(e) => { e.stopPropagation(); handlePermanentDelete(exercise); }}
                              >
                                <TrashIcon />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      <ExerciseForm
        isOpen={isFormOpen}
        initialData={editingExercise}
        onSave={handleSaveExercise}
        onCancel={() => {
          setIsFormOpen(false);
          setEditingExercise(undefined);
        }}
        isLoading={formLoading}
      />

      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        isDestructive={true}
        isLoading={confirmDialog.isLoading}
        onConfirm={confirmDialog.action}
        onCancel={() => setConfirmDialog((prev) => ({ ...prev, isOpen: false }))}
      />

      {/* Details Display Modal */}
      {viewingExercise && (
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
          onClick={() => setViewingExercise(undefined)}
        >
          <div
            className="card animate-slide-up"
            style={{ width: "100%", maxWidth: "600px", padding: "24px", maxHeight: "90vh", overflowY: "auto" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
              <h3 style={{ fontSize: "20px", fontWeight: 700, margin: 0, color: "var(--color-text-primary)" }}>
                {viewingExercise.name}
              </h3>
              <button
                className="btn btn-secondary"
                style={{ padding: "4px 8px", minWidth: "auto", height: "auto" }}
                onClick={() => setViewingExercise(undefined)}
              >
                Close
              </button>
            </div>

            <p style={{ fontSize: "15px", color: "var(--color-text-secondary)", lineHeight: "1.6", marginBottom: "20px", whiteSpace: "pre-wrap" }}>
              {viewingExercise.description || "No description provided."}
            </p>

            <h4 style={{ fontSize: "14px", fontWeight: 600, marginBottom: "12px", color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Exercise Images ({viewingExercise.images?.length || 0})
            </h4>

            {viewingExercise.images && viewingExercise.images.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                {viewingExercise.images.map((img, index) => (
                  <div key={index} style={{ border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", overflow: "hidden", backgroundColor: "var(--color-page-bg)" }}>
                    <div style={{ height: "240px", width: "100%", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "#fff" }}>
                      <img
                        src={img.filepath}
                        alt={img.imageName || `Image ${index + 1}`}
                        style={{ width: "100%", height: "100%", objectFit: "contain" }}
                      />
                    </div>
                    {img.imageName && (
                      <div style={{ padding: "8px 12px", fontSize: "13px", fontWeight: 500, color: "var(--color-text-primary)", borderTop: "1px solid var(--color-border)" }}>
                        {img.imageName}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ padding: "24px", textAlign: "center", color: "var(--color-text-muted)", border: "1px dashed var(--color-border)", borderRadius: "var(--radius-md)" }}>
                No images uploaded for this exercise.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
