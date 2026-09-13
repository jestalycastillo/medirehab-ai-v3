"use client";

import { useEffect, useState } from "react";
import { type PatientProfile } from "@/lib/api";

export function PatientProfileForm({
  initialData,
  onSave,
  isLoading,
}: {
  initialData?: Partial<PatientProfile> | null;
  onSave: (data: Partial<PatientProfile>) => void;
  isLoading: boolean;
}) {
  const [formData, setFormData] = useState<Partial<PatientProfile>>({});

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFormData({
      firstName: initialData?.firstName || "",
      lastName: initialData?.lastName || "",
      birthDate: initialData?.birthDate ? initialData.birthDate.slice(0, 10) : "",
      gender: initialData?.gender || "",
      contactNumber: initialData?.contactNumber || "",
      address: initialData?.address || "",
      medicalCondition: initialData?.medicalCondition || "",
    });
  }, [initialData]);

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
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <div className="doctor-form-grid">
        <div>
          <label style={{ display: "block", fontSize: "14px", fontWeight: 500, marginBottom: "6px" }}>First Name</label>
          <input className="input" name="firstName" value={formData.firstName || ""} onChange={handleChange} />
        </div>
        <div>
          <label style={{ display: "block", fontSize: "14px", fontWeight: 500, marginBottom: "6px" }}>Last Name</label>
          <input className="input" name="lastName" value={formData.lastName || ""} onChange={handleChange} />
        </div>
      </div>

      <div className="doctor-form-grid">
        <div>
          <label style={{ display: "block", fontSize: "14px", fontWeight: 500, marginBottom: "6px" }}>Birth Date</label>
          <input type="date" className="input" name="birthDate" value={formData.birthDate || ""} onChange={handleChange} />
        </div>
        <div>
          <label style={{ display: "block", fontSize: "14px", fontWeight: 500, marginBottom: "6px" }}>Gender</label>
          <select className="input" name="gender" value={formData.gender || ""} onChange={handleChange}>
            <option value="">Select gender</option>
            <option value="female">Female</option>
            <option value="male">Male</option>
            <option value="other">Other</option>
          </select>
        </div>
      </div>

      <div>
        <label style={{ display: "block", fontSize: "14px", fontWeight: 500, marginBottom: "6px" }}>Contact Number</label>
        <input className="input" name="contactNumber" value={formData.contactNumber || ""} onChange={handleChange} />
      </div>

      <div>
        <label style={{ display: "block", fontSize: "14px", fontWeight: 500, marginBottom: "6px" }}>Address</label>
        <textarea className="input" name="address" value={formData.address || ""} onChange={handleChange} style={{ minHeight: "84px", paddingTop: "10px", resize: "vertical" }} />
      </div>

      <div>
        <label style={{ display: "block", fontSize: "14px", fontWeight: 500, marginBottom: "6px" }}>Medical Condition</label>
        <textarea className="input" name="medicalCondition" value={formData.medicalCondition || ""} onChange={handleChange} style={{ minHeight: "96px", paddingTop: "10px", resize: "vertical" }} />
      </div>

      <button type="submit" className="btn btn-primary" disabled={isLoading} style={{ alignSelf: "flex-start", minWidth: "130px" }}>
        {isLoading ? <div className="spinner spinner-white" style={{ width: "16px", height: "16px" }} /> : "Save Profile"}
      </button>
    </form>
  );
}
