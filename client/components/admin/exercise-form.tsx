import { useState, useEffect } from "react";
import { type ApiExercise, type ExerciseImage } from "@/lib/api";
import { usePortalModalFocus } from "@/components/ui/use-portal-modal-focus";

export function ExerciseForm({
  isOpen,
  initialData,
  onSave,
  onCancel,
  isLoading,
  error,
}: {
  isOpen: boolean;
  initialData?: ApiExercise;
  onSave: (data: { name: string; description: string; analysisModelKey?: string | null; images: ExerciseImage[]; guidelineSlides: string[] }) => void;
  onCancel: () => void;
  isLoading: boolean;
  error?: string;
}) {
  const [formData, setFormData] = useState<{
    name: string;
    description: string;
    analysisModelKey: string;
    images: ExerciseImage[];
    guidelineSlides: string[];
  }>({
    name: "",
    description: "",
    analysisModelKey: "",
    images: [],
    guidelineSlides: [],
  });
  const modalRef = usePortalModalFocus(isOpen, onCancel);
  const [uploadError, setUploadError] = useState("");

  useEffect(() => {
    if (initialData) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFormData({
        name: initialData.name || "",
        description: initialData.description || "",
        analysisModelKey: initialData.analysisModelKey || "",
        images: initialData.images || [],
        guidelineSlides: initialData.guidelineSlides || [],
      });
    } else {
      setFormData({ name: "", description: "", analysisModelKey: "", images: [], guidelineSlides: [] });
    }
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleImageChange = (index: number, field: keyof ExerciseImage, value: string) => {
    const newImages = [...formData.images];
    newImages[index] = { ...newImages[index], [field]: value };
    setFormData({ ...formData, images: newImages });
  };

  const handleAddImage = () => {
    setFormData({ ...formData, images: [...formData.images, { imageName: "", filepath: "" }] });
  };

  const handleRemoveImage = (index: number) => {
    const newImages = [...formData.images];
    newImages.splice(index, 1);
    setFormData({ ...formData, images: newImages });
  };

  const handleGuidelineChange = (index: number, value: string) => {
    const guidelineSlides = [...formData.guidelineSlides];
    guidelineSlides[index] = value;
    setFormData({ ...formData, guidelineSlides });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      ...formData,
      analysisModelKey: formData.analysisModelKey.trim() ? formData.analysisModelKey.trim() : null,
    });
  };

  return (
    <div className="portal-modal-overlay" onClick={onCancel}>
      <div
        ref={modalRef} tabIndex={-1}
        className="portal-modal-panel portal-modal-wide animate-slide-up"
        role="dialog" aria-modal="true" aria-labelledby="exercise-form-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="portal-modal-header">
          <span className="role-dashboard-eyebrow">Exercise library</span>
          <h2 id="exercise-form-title">Edit exercise</h2>
          <p>Update the guide and its evaluation settings.</p>
        </div>
        <form onSubmit={handleSubmit} className="portal-modal-form-content">
          <div className="portal-modal-body">
          {error && <div className="portal-modal-error" role="alert">{error}</div>}
          {uploadError && <div className="portal-modal-error" role="alert">{uploadError}</div>}
          <div>
            <label htmlFor="exercise-form-name">Exercise name</label>
            <input id="exercise-form-name" type="text" name="name" className="input" value={formData.name} onChange={handleChange} required />
          </div>
          <div>
            <label htmlFor="exercise-form-description">Description</label>
            <textarea
              id="exercise-form-description"
              name="description"
              className="input"
              value={formData.description}
              onChange={handleChange}
              style={{ minHeight: "80px", padding: "10px 14px" }}
              required
            />
          </div>
          <div>
            <label htmlFor="exercise-form-model">AI evaluation model</label>
            <select
              id="exercise-form-model"
              name="analysisModelKey"
              className="input"
              value={formData.analysisModelKey}
              onChange={handleChange}
            >
              <option value="">No evaluation model</option>
              <option value="shoulder_flexion">Shoulder Flexion (shoulder_flexion)</option>
              <option value="shoulder_abduction">Shoulder Abduction (shoulder_abduction)</option>
              <option value="side_arms_raise_v1">Side Arms Raise (side_arms_raise_v1)</option>
              <option value="arm_circumduction">Arm Circumduction (arm_circumduction)</option>
              <option value="cross_body_shoulder_stretch">Cross-body Shoulder Stretch (cross_body_shoulder_stretch)</option>
              <option value="external_rotation">External Rotation (external_rotation)</option>
              <option value="internal_rotation">Internal Rotation (internal_rotation)</option>
            </select>
          </div>

          <div>
            <div className="portal-modal-section-heading">
              <div><strong>Guidelines & safety slideshow</strong><p>Patients read this before their first recording. Updating it asks every patient to read the new version.</p></div>
              <button type="button" className="btn btn-secondary" onClick={() => setFormData({ ...formData, guidelineSlides: [...formData.guidelineSlides, ""] })}>Add slide</button>
            </div>
            {formData.guidelineSlides.length === 0 ? <p style={{ fontSize: "13px", color: "var(--color-text-muted)" }}>The built-in safety template will be used until you add custom slides.</p> : (
              <div style={{ display: "grid", gap: "10px" }}>
                {formData.guidelineSlides.map((slide, index) => (
                  <div key={index} style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "8px", alignItems: "start" }}>
                    <textarea className="input" aria-label={`Guideline slide ${index + 1}`} value={slide} onChange={(event) => handleGuidelineChange(index, event.target.value)} placeholder={`Slide ${index + 1}`} style={{ minHeight: "70px", padding: "10px 14px" }} required />
                    <button type="button" className="btn btn-secondary" onClick={() => setFormData({ ...formData, guidelineSlides: formData.guidelineSlides.filter((_, slideIndex) => slideIndex !== index) })}>Remove</button>
                  </div>
                ))}
              </div>
            )}
          </div>
          
          <div>
            <div className="portal-modal-section-heading">
              <strong>Images</strong>
              <button type="button" className="btn btn-secondary" onClick={handleAddImage}>
                Add image
              </button>
            </div>
            {formData.images.length === 0 && (
              <div style={{ fontSize: "13px", color: "var(--color-text-muted)" }}>No images added.</div>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {formData.images.map((img, i) => {
                const uploadFile = async (file: File) => {
                  setUploadError("");
                  handleImageChange(i, "filepath", "Uploading...");

                  const formDataObj = new FormData();
                  formDataObj.append("image", file);

                  try {
                    const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";
                    const res = await fetch(`${apiBase}/upload`, {
                      method: "POST",
                      body: formDataObj,
                    });
                    const data = await res.json();
                    if (data.success && data.filepath) {
                      handleImageChange(i, "filepath", data.filepath);
                    } else {
                      handleImageChange(i, "filepath", "");
                      setUploadError(data.message || "Upload failed.");
                    }
                  } catch {
                    handleImageChange(i, "filepath", "");
                    setUploadError("Upload failed. Make sure backend is running.");
                  }
                };

                return (
                  <div key={i} className="portal-modal-image" style={{ display: "flex", gap: "12px", alignItems: "center", border: "1px solid var(--color-border)", padding: "12px", borderRadius: "var(--radius-md)", backgroundColor: "var(--color-page-bg)" }}>
                  {img.filepath && !img.filepath.startsWith("Uploading") ? (
                    <div style={{ width: "64px", height: "64px", borderRadius: "var(--radius-sm)", overflow: "hidden", border: "1px solid var(--color-border)", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "white", flexShrink: 0 }}>
                      <img
                        src={img.filepath}
                        alt={img.imageName || "Preview"}
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                        onError={(e) => {
                          e.currentTarget.style.display = "none";
                          const par = e.currentTarget.parentElement;
                          if (par) {
                            const fallback = par.querySelector(".preview-fallback");
                            if (fallback) (fallback as HTMLElement).style.display = "block";
                          }
                        }}
                      />
                      <span className="preview-fallback" style={{ display: "none", fontSize: "10px", color: "var(--color-text-muted)", textAlign: "center" }}>Broken URL</span>
                    </div>
                  ) : img.filepath?.startsWith("Uploading") ? (
                    <div style={{ width: "64px", height: "64px", borderRadius: "var(--radius-sm)", border: "1px dashed var(--color-border)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <div className="spinner" style={{ width: "16px", height: "16px" }} />
                    </div>
                  ) : (
                    <div style={{ width: "64px", height: "64px", borderRadius: "var(--radius-sm)", border: "1px dashed var(--color-border)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--color-text-muted)", fontSize: "10px", flexShrink: 0, textAlign: "center" }}>
                      No URL
                    </div>
                  )}
                  <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "8px" }}>
                    <input
                      type="text"
                      className="input"
                      placeholder="Image Name (e.g. squat_pose)"
                      value={img.imageName}
                      onChange={(e) => handleImageChange(i, "imageName", e.target.value)}
                      required
                    />
                    {img.filepath && !img.filepath.startsWith("Uploading") ? (
                      <div style={{ fontSize: "11px", color: "var(--color-text-secondary)", wordBreak: "break-all", maxWidth: "240px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {img.filepath}
                      </div>
                    ) : null}
                    <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                      <label style={{ fontSize: "11px", color: "var(--color-text-muted)", fontWeight: 500, marginBottom: "4px" }}>
                        {img.filepath?.startsWith("Uploading") ? "Uploading..." : img.filepath ? "Change image file:" : "Upload image file:"}
                      </label>
                      <div
                        style={{
                          border: "2px dashed var(--color-border)",
                          borderRadius: "var(--radius-md)",
                          padding: "16px",
                          textAlign: "center",
                          cursor: "pointer",
                          backgroundColor: "var(--color-page-bg)",
                          transition: "all 0.2s ease",
                        }}
                        onDragOver={(e) => {
                          e.preventDefault();
                          e.currentTarget.style.borderColor = "var(--color-primary)";
                          e.currentTarget.style.backgroundColor = "var(--color-primary-soft)";
                        }}
                        onDragLeave={(e) => {
                          e.preventDefault();
                          e.currentTarget.style.borderColor = "var(--color-border)";
                          e.currentTarget.style.backgroundColor = "var(--color-page-bg)";
                        }}
                        onDrop={async (e) => {
                          e.preventDefault();
                          e.currentTarget.style.borderColor = "var(--color-border)";
                          e.currentTarget.style.backgroundColor = "var(--color-page-bg)";
                          const file = e.dataTransfer.files?.[0];
                          if (file) {
                            await uploadFile(file);
                          }
                        }}
                        onClick={() => {
                          const fileInput = document.getElementById(`file-input-${i}`);
                          if (fileInput) fileInput.click();
                        }}
                      >
                        <span style={{ fontSize: "13px", color: "var(--color-text-secondary)" }}>
                          {img.filepath?.startsWith("Uploading") ? "Uploading..." : "Drag & drop image here, or click to upload"}
                        </span>
                        <input
                          id={`file-input-${i}`}
                          type="file"
                          accept="image/*"
                          style={{ display: "none" }}
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              await uploadFile(file);
                            }
                          }}
                        />
                      </div>
                    </div>
                  </div>
                  <button type="button" className="btn btn-danger" aria-label={`Remove image ${i + 1}`} style={{ padding: "0 12px", display: "flex", alignItems: "center", justifyContent: "center" }} onClick={() => handleRemoveImage(i)}>
                    Remove
                  </button>
                </div>
              ); })}
            </div>
          </div>

          </div>
          <div className="portal-modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={isLoading}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={isLoading}>
              {isLoading ? <><span className="spinner spinner-white" style={{ width: "16px", height: "16px" }} aria-hidden="true" />Saving…</> : "Save changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
