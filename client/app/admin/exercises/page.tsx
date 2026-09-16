"use client";

import { useEffect, useState } from "react";
import { api, type ApiExercise, ApiError, type ExerciseImage } from "@/lib/api";
import { StatusBadge } from "@/components/ui/status-badge";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ExerciseForm } from "@/components/admin/exercise-form";
import { ExerciseThumbnail } from "@/components/ui/exercise-thumbnail";
import { usePortalModalFocus } from "@/components/ui/use-portal-modal-focus";

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
  const detailModalRef = usePortalModalFocus(Boolean(viewingExercise), () => setViewingExercise(undefined));
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
    setError("");
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
    if (!editingExercise) return;
    setFormLoading(true);
    try {
      await api.updateExercise(editingExercise.id, data);
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
    <div className="role-dashboard admin-subpage exercise-catalog-page animate-fade-in">
      <header className="role-dashboard-header">
        <div>
          <span className="role-dashboard-eyebrow">Admin / Exercises</span>
          <h1>Exercises</h1>
          <p>Review movement guides, preview demos, and manage which exercises are available for care plans.</p>
        </div>
      </header>

      <section className="exercise-catalog-section" aria-label="Exercise catalog">
        <div className="exercise-catalog-toolbar">
          <div className="exercise-catalog-toolbar-copy">
            <h2>Browse library</h2>
            <p>{accountTab === "ACTIVE" ? "Exercises currently available to clinicians." : "Exercises removed from active care plans."}</p>
          </div>
          <div className="exercise-catalog-controls">
          <div className="account-tabs" role="group" aria-label="Exercise status">
            <button
              type="button"
              className={`account-tab ${accountTab === "ACTIVE" ? "account-tab-active" : ""}`}
              onClick={() => setAccountTab("ACTIVE")}
              aria-pressed={accountTab === "ACTIVE"}
              aria-label={`Available exercises, ${activeAccountCount}`}
              title="Available exercises"
            >
              <ActiveExercisesIcon />
              <span>Available</span>
              <span className="account-tab-count">{activeAccountCount}</span>
            </button>
            <button
              type="button"
              className={`account-tab ${accountTab === "ARCHIVED" ? "account-tab-active" : ""}`}
              onClick={() => setAccountTab("ARCHIVED")}
              aria-pressed={accountTab === "ARCHIVED"}
              aria-label={`Archived exercises, ${archivedAccountCount}`}
              title="Archived exercises"
            >
              <ArchiveIcon />
              <span>Archived</span>
              <span className="account-tab-count">{archivedAccountCount}</span>
            </button>
          </div>

          <input
            type="text"
            className="input exercise-catalog-search"
            aria-label="Search exercises by name"
            placeholder="Search by name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          </div>
        </div>

        {error && (
          <div className="exercise-catalog-error" role="alert">
            <div><strong>Could not load exercises</strong><p>{error}</p></div>
            <button type="button" className="btn btn-secondary" onClick={loadExercises}>Try again</button>
          </div>
        )}

        {loading ? (
          <div style={{ display: "flex", justifyContent: "center", padding: "40px" }}>
            <div className="spinner"></div>
          </div>
        ) : error ? null : (
          <div>
            {filteredExercises.length === 0 ? (
              <div className="exercise-catalog-empty">
                <span className="exercise-catalog-empty-icon" aria-hidden="true"><ActiveExercisesIcon /></span>
                <h2>{searchTerm ? "No matching exercises" : accountTab === "ARCHIVED" ? "No archived exercises" : "No available exercises"}</h2>
                <p>{searchTerm ? `No ${accountTab === "ARCHIVED" ? "archived" : "available"} exercise matches “${searchTerm}”.` : accountTab === "ARCHIVED" ? "Archived exercises will appear here." : "Available exercises will appear here when the catalog is populated."}</p>
                {searchTerm && <button type="button" className="btn btn-secondary" onClick={() => setSearchTerm("")}>Clear search</button>}
              </div>
            ) : (
              <div className="exercise-catalog-grid">
                {filteredExercises.map((exercise) => {
                  const mainImage = exercise.images && exercise.images.length > 0 ? exercise.images[0].filepath : null;
                  return (
                    <article key={exercise.id} className="exercise-catalog-card">
                      <div className="exercise-catalog-media">
                        {mainImage ? (
                          <ExerciseThumbnail
                            imagePath={mainImage}
                            alt={exercise.name}
                            modelKey={exercise.analysisModelKey}
                            onImageError={(e) => {
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
                        <div className="exercise-catalog-status">
                          <StatusBadge isActive={!exercise.archivedAt} archivedAt={exercise.archivedAt} />
                        </div>
                      </div>
                      <div className="exercise-catalog-content">
                        <h3>
                          {exercise.name || exercise.id}
                        </h3>
                        <p>
                          {exercise.description || "-"}
                        </p>
                        <div className="exercise-catalog-actions">
                          <button type="button" className="btn btn-primary" onClick={() => setViewingExercise(exercise)}>
                            View details
                          </button>
                          <button type="button" className="exercise-catalog-action" onClick={() => { setEditingExercise(exercise); setIsFormOpen(true); }}>
                            <EditIcon /> Edit
                          </button>
                          {accountTab === "ACTIVE" && !exercise.archivedAt && (
                            <button type="button" className="exercise-catalog-action" onClick={() => handleArchive(exercise)}>
                              <ArchiveIcon /> Archive
                            </button>
                          )}
                          {accountTab === "ARCHIVED" && exercise.archivedAt && (
                            <button type="button" className="exercise-catalog-action" onClick={() => handleRestore(exercise)}>
                              <RestoreIcon /> Restore
                            </button>
                          )}
                          {accountTab === "ARCHIVED" && exercise.archivedAt && (
                            <button type="button" className="exercise-catalog-action exercise-catalog-action-danger" onClick={() => handlePermanentDelete(exercise)}>
                              <TrashIcon /> Delete
                            </button>
                          )}
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </section>

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
        <div className="portal-modal-overlay" onClick={() => setViewingExercise(undefined)}>
          <div
            ref={detailModalRef} tabIndex={-1}
            className="portal-modal-panel portal-modal-detail animate-slide-up"
            role="dialog" aria-modal="true" aria-labelledby="exercise-detail-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="portal-modal-header portal-modal-detail-heading">
              <div><span className="role-dashboard-eyebrow">Exercise library</span><h2 id="exercise-detail-title">
                {viewingExercise.name}
              </h2></div>
              <button
                className="btn btn-secondary"
                onClick={() => setViewingExercise(undefined)}
              >
                Close
              </button>
            </div>

            <div className="portal-modal-detail-body">
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
        </div>
      )}
    </div>
  );
}
