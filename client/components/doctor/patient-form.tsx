"use client";

import { useEffect, useState } from "react";
import { type ApiPatient, type PatientProfile } from "@/lib/api";
import { usePortalModalFocus } from "@/components/ui/use-portal-modal-focus";

type PatientFormData = Partial<ApiPatient & PatientProfile>;

export function PatientForm({
  isOpen,
  initialData,
  onSave,
  onCancel,
  isLoading,
  error,
}: {
  isOpen: boolean;
  initialData?: ApiPatient;
  onSave: (data: PatientFormData) => void;
  onCancel: () => void;
  isLoading: boolean;
  error?: string;
}) {
  const [formData, setFormData] = useState<PatientFormData>({});
  const modalRef = usePortalModalFocus(isOpen, onCancel);

  useEffect(() => {
    if (initialData) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFormData({
        email: initialData.email,
        firstName: initialData.profile?.firstName || "",
        lastName: initialData.profile?.lastName || "",
        birthDate: initialData.profile?.birthDate ? initialData.profile.birthDate.slice(0, 10) : "",
        gender: initialData.profile?.gender || "",
        contactNumber: initialData.profile?.contactNumber || "",
        address: initialData.profile?.address || "",
        medicalCondition: initialData.profile?.medicalCondition || "",
      });
    } else {
      setFormData({});
    }
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  const handleChange = (
    event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    setFormData({ ...formData, [event.target.name]: event.target.value });
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    onSave(formData);
  };

  return (
    <div className="portal-modal-overlay" onClick={onCancel}>
      <div
        ref={modalRef} tabIndex={-1}
        className="portal-modal-panel portal-modal-wide animate-slide-up"
        role="dialog" aria-modal="true" aria-labelledby="patient-form-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="portal-modal-header">
          <span className="role-dashboard-eyebrow">Patient account</span>
          <h2 id="patient-form-title">{initialData ? "Edit patient" : "Create patient"}</h2>
          <p>{initialData ? "Update the patient’s care information." : "Add a patient to the care directory."}</p>
        </div>
        <form onSubmit={handleSubmit} className="portal-modal-form-content">
          <div className="portal-modal-body">
          {error && <div className="portal-modal-error" role="alert">{error}</div>}
          {!initialData && (
            <div>
              <label htmlFor="patient-form-email">Email</label>
              <input id="patient-form-email" type="email" name="email" className="input" autoComplete="email" value={formData.email || ""} onChange={handleChange} required />
            </div>
          )}

          <div className="portal-modal-grid">
            <div>
              <label htmlFor="patient-form-first">First name</label>
              <input id="patient-form-first" type="text" name="firstName" className="input" autoComplete="given-name" value={formData.firstName || ""} onChange={handleChange} required />
            </div>
            <div>
              <label htmlFor="patient-form-last">Last name</label>
              <input id="patient-form-last" type="text" name="lastName" className="input" autoComplete="family-name" value={formData.lastName || ""} onChange={handleChange} required />
            </div>
          </div>

          <div className="portal-modal-grid">
            <div>
              <label htmlFor="patient-form-birth">Birth date</label>
              <input id="patient-form-birth" type="date" name="birthDate" className="input" value={formData.birthDate || ""} onChange={handleChange} />
            </div>
            <div>
              <label htmlFor="patient-form-gender">Gender</label>
              <select id="patient-form-gender" name="gender" className="input" value={formData.gender || ""} onChange={handleChange}>
                <option value="">Select gender</option>
                <option value="female">Female</option>
                <option value="male">Male</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="patient-form-contact">Contact number</label>
            <input id="patient-form-contact" type="text" name="contactNumber" className="input" autoComplete="tel" value={formData.contactNumber || ""} onChange={handleChange} />
          </div>

          <div>
            <label htmlFor="patient-form-address">Address</label>
            <textarea id="patient-form-address" name="address" className="input" value={formData.address || ""} onChange={handleChange} style={{ minHeight: "84px", paddingTop: "10px", resize: "vertical" }} />
          </div>

          <div>
            <label htmlFor="patient-form-condition">Medical condition</label>
            <textarea id="patient-form-condition" name="medicalCondition" className="input" value={formData.medicalCondition || ""} onChange={handleChange} style={{ minHeight: "96px", paddingTop: "10px", resize: "vertical" }} />
          </div>

          </div>
          <div className="portal-modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={isLoading}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={isLoading}>
              {isLoading ? <div className="spinner spinner-white" style={{ width: "16px", height: "16px" }} /> : initialData ? "Save changes" : "Create patient"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
