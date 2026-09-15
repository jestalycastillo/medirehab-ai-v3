import { useState, useEffect } from "react";
import { type ApiExercise, type ExerciseImage } from "@/lib/api";

export function ExerciseForm({
  isOpen,
  initialData,
  onSave,
  onCancel,
  isLoading,
}: {
  isOpen: boolean;
  initialData?: ApiExercise;
  onSave: (data: { name: string; description: string; analysisModelKey?: string | null; images: ExerciseImage[] }) => void;
  onCancel: () => void;
  isLoading: boolean;
}) {
  const [formData, setFormData] = useState<{
    name: string;
    description: string;
    analysisModelKey: string;
    images: ExerciseImage[];
  }>({
    name: "",
    description: "",
    analysisModelKey: "",
    images: [],
  });

  useEffect(() => {
    if (initialData) {
      setFormData({
        name: initialData.name || "",
        description: initialData.description || "",
        analysisModelKey: initialData.analysisModelKey || "",
        images: initialData.images || [],
      });
    } else {
      setFormData({ name: "", description: "", analysisModelKey: "", images: [] });
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      ...formData,
      analysisModelKey: formData.analysisModelKey.trim() ? formData.analysisModelKey.trim() : null,
    });
  };

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(15, 23, 42, 0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 50,
        padding: "20px",
      }}
      onClick={onCancel}
    >
      <div
        className="card animate-slide-up"
        style={{ width: "100%", maxWidth: "500px", padding: "24px", maxHeight: "90vh", overflowY: "auto" }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 style={{ fontSize: "18px", fontWeight: 600, margin: "0 0 20px 0", color: "var(--color-text-primary)" }}>
          Edit Exercise
        </h3>
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div>
            <label style={{ display: "block", fontSize: "14px", fontWeight: 500, marginBottom: "6px" }}>Exercise Name</label>
            <input type="text" name="name" className="input" value={formData.name} onChange={handleChange} required />
          </div>
          <div>
            <label style={{ display: "block", fontSize: "14px", fontWeight: 500, marginBottom: "6px" }}>Description</label>
            <textarea
              name="description"
              className="input"
              value={formData.description}
              onChange={handleChange}
              style={{ minHeight: "80px", padding: "10px 14px" }}
              required
            />
          </div>
          <div>
            <label style={{ display: "block", fontSize: "14px", fontWeight: 500, marginBottom: "6px" }}>AI Evaluation Model</label>
            <select
              name="analysisModelKey"
              className="input"
              value={formData.analysisModelKey}
              onChange={handleChange}
            >
              <option value="shoulder_flexion">Shoulder Flexion (shoulder_flexion)</option>
              <option value="shoulder_abduction">Shoulder Abduction (shoulder_abduction)</option>
            </select>
          </div>
          
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
              <label style={{ display: "block", fontSize: "14px", fontWeight: 500 }}>Images</label>
              <button type="button" className="btn btn-secondary" style={{ height: "28px", padding: "0 8px", fontSize: "12px" }} onClick={handleAddImage}>
                + Add Image
              </button>
            </div>
            {formData.images.length === 0 && (
              <div style={{ fontSize: "13px", color: "var(--color-text-muted)" }}>No images added.</div>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {formData.images.map((img, i) => {
                const uploadFile = async (file: File) => {
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
                      alert(data.message || "Upload failed.");
                    }
                  } catch (err) {
                    handleImageChange(i, "filepath", "");
                    alert("Upload failed. Make sure backend is running.");
                  }
                };

                return (
                  <div key={i} style={{ display: "flex", gap: "12px", alignItems: "center", border: "1px solid var(--color-border)", padding: "12px", borderRadius: "var(--radius-md)", backgroundColor: "var(--color-page-bg)" }}>
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
                  <button type="button" className="btn btn-danger" style={{ height: "36px", padding: "0 12px", display: "flex", alignItems: "center", justifyContent: "center" }} onClick={() => handleRemoveImage(i)}>
                    X
                  </button>
                </div>
              ); })}
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px", marginTop: "8px" }}>
            <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={isLoading}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={isLoading} style={{ minWidth: "100px" }}>
              {isLoading ? <div className="spinner spinner-white" style={{ width: "16px", height: "16px" }} /> : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
