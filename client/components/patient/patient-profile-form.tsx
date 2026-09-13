"use client";

import { useEffect, useState } from "react";
import { type PatientProfile } from "@/lib/api";
import { LoaderCircle, Save } from "lucide-react";
import { Button } from "@/components/ui/button";

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
    <form onSubmit={handleSubmit} className="patient-profile-form">
      <div className="patient-profile-form-grid">
        <div>
          <label>First name</label>
          <input className="input" name="firstName" value={formData.firstName || ""} onChange={handleChange} />
        </div>
        <div>
          <label>Last name</label>
          <input className="input" name="lastName" value={formData.lastName || ""} onChange={handleChange} />
        </div>
      </div>

      <div className="patient-profile-form-grid">
        <div>
          <label>Birth date</label>
          <input type="date" className="input" name="birthDate" value={formData.birthDate || ""} onChange={handleChange} />
        </div>
        <div>
          <label>Gender</label>
          <select className="input" name="gender" value={formData.gender || ""} onChange={handleChange}>
            <option value="">Select gender</option>
            <option value="female">Female</option>
            <option value="male">Male</option>
            <option value="other">Other</option>
          </select>
        </div>
      </div>

      <div>
        <label>Contact number</label>
        <input className="input" name="contactNumber" value={formData.contactNumber || ""} onChange={handleChange} />
      </div>

      <div>
        <label>Address</label>
        <textarea className="input" name="address" value={formData.address || ""} onChange={handleChange} style={{ minHeight: "84px", paddingTop: "10px", resize: "vertical" }} />
      </div>

      <div>
        <label>Medical condition</label>
        <textarea className="input" name="medicalCondition" value={formData.medicalCondition || ""} onChange={handleChange} style={{ minHeight: "96px", paddingTop: "10px", resize: "vertical" }} />
      </div>

      <Button type="submit" disabled={isLoading} className="patient-profile-save">
        {isLoading ? <LoaderCircle className="recorder-spin" /> : <Save />} Save information
      </Button>
    </form>
  );
}
