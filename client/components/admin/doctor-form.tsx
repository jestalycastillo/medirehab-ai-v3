import { useState, useEffect } from "react";
import { type ApiDoctor, type DoctorProfile } from "@/lib/api";
import { usePortalModalFocus } from "@/components/ui/use-portal-modal-focus";

export function DoctorForm({
  isOpen,
  initialData,
  onSave,
  onCancel,
  isLoading,
  error,
}: {
  isOpen: boolean;
  initialData?: ApiDoctor;
  onSave: (data: Partial<ApiDoctor & DoctorProfile>) => void;
  onCancel: () => void;
  isLoading: boolean;
  error?: string;
}) {
  const [formData, setFormData] = useState<Partial<ApiDoctor & DoctorProfile>>({});
  const modalRef = usePortalModalFocus(isOpen, onCancel);

  useEffect(() => {
    if (initialData) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFormData({
        email: initialData.email,
        firstName: initialData.profile?.firstName || "",
        lastName: initialData.profile?.lastName || "",
        specialization: initialData.profile?.specialization || "",
        licenseNumber: initialData.profile?.licenseNumber || "",
        contactNumber: initialData.profile?.contactNumber || "",
        clinicSchedule: initialData.profile?.clinicSchedule || "",
      });
    } else {
      setFormData({});
    }
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <div className="portal-modal-overlay" onClick={onCancel}>
      <div
        ref={modalRef} tabIndex={-1}
        className="portal-modal-panel portal-modal-form animate-slide-up"
        role="dialog" aria-modal="true" aria-labelledby="doctor-form-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="portal-modal-header">
          <span className="role-dashboard-eyebrow">Doctor account</span>
          <h2 id="doctor-form-title">{initialData ? "Edit doctor" : "Create doctor"}</h2>
          <p>{initialData ? "Update the clinician’s profile details." : "Add a clinician to your care team."}</p>
        </div>
        <form onSubmit={handleSubmit} className="portal-modal-form-content">
          <div className="portal-modal-body">
          {error && <div className="portal-modal-error" role="alert">{error}</div>}
          {!initialData && (
            <div>
              <label htmlFor="doctor-form-email">Email</label>
              <input id="doctor-form-email" type="email" name="email" className="input" autoComplete="email" value={formData.email || ""} onChange={handleChange} required />
            </div>
          )}
          <div className="portal-modal-grid">
            <div>
              <label htmlFor="doctor-form-first">First name</label>
              <input id="doctor-form-first" type="text" name="firstName" className="input" autoComplete="given-name" value={formData.firstName || ""} onChange={handleChange} required />
            </div>
            <div>
              <label htmlFor="doctor-form-last">Last name</label>
              <input id="doctor-form-last" type="text" name="lastName" className="input" autoComplete="family-name" value={formData.lastName || ""} onChange={handleChange} required />
            </div>
          </div>
          <div>
            <label htmlFor="doctor-form-specialization">Specialization</label>
            <input id="doctor-form-specialization" type="text" name="specialization" className="input" value={formData.specialization || ""} onChange={handleChange} />
          </div>
          <div className="portal-modal-grid">
            <div>
              <label htmlFor="doctor-form-license">License number</label>
              <input id="doctor-form-license" type="text" name="licenseNumber" className="input" value={formData.licenseNumber || ""} onChange={handleChange} />
            </div>
            <div>
              <label htmlFor="doctor-form-contact">Contact number</label>
              <input id="doctor-form-contact" type="text" name="contactNumber" className="input" autoComplete="tel" value={formData.contactNumber || ""} onChange={handleChange} />
            </div>
          </div>
          <div>
            <label htmlFor="doctor-form-schedule">Clinic schedule</label>
            <input id="doctor-form-schedule" type="text" name="clinicSchedule" className="input" value={formData.clinicSchedule || ""} onChange={handleChange} />
          </div>
          </div>
          <div className="portal-modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={isLoading}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={isLoading}>
              {isLoading ? <><span className="spinner spinner-white" style={{ width: "16px", height: "16px" }} aria-hidden="true" />Saving…</> : initialData ? "Save changes" : "Create doctor"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
