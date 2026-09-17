"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { api, ApiError, type DoctorProfile } from "@/lib/api";
import { NotificationPreferences } from "@/components/care/notification-preferences";
import { CheckCircle2, CircleAlert } from "lucide-react";

export default function DoctorProfilePage() {
  const { user, refreshUser } = useAuth();
  const [profile, setProfile] = useState<Partial<DoctorProfile>>({});
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [profileMessage, setProfileMessage] = useState("");
  const [passwordMessage, setPasswordMessage] = useState("");
  const [error, setError] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  useEffect(() => {
    let mounted = true;
    api
      .getProfile()
      .then((res) => {
        if (mounted) setProfile((res.user.profile as DoctorProfile) ?? {});
      })
      .catch((err) => {
        if (mounted) setError(err instanceof ApiError ? err.message : "Failed to load profile.");
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const handleProfileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setProfile({ ...profile, [event.target.name]: event.target.value });
  };

  const handleSaveProfile = async (event: React.FormEvent) => {
    event.preventDefault();
    setSavingProfile(true);
    setError("");
    setProfileMessage("");
    try {
      const res = await api.updateProfile(profile);
      setProfile((res.user.profile as DoctorProfile) ?? {});
      setProfileMessage("Profile updated successfully.");
      await refreshUser();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to update profile.");
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setPasswordMessage("");

    if (newPassword !== confirmPassword) {
      setError("New passwords do not match.");
      return;
    }

    if (currentPassword === newPassword) {
      setError("New password must be different from your current password.");
      return;
    }

    setSavingPassword(true);
    try {
      await api.changePassword(currentPassword, newPassword);
      setPasswordMessage("Password changed successfully.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      await refreshUser();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to change password.");
    } finally {
      setSavingPassword(false);
    }
  };

  if (loading) return <div className="role-dashboard-loading" role="status"><div className="spinner" aria-hidden="true" />Loading your profile…</div>;

  return (
    <div className="role-dashboard care-page doctor-profile-page animate-fade-in">
      <header className="role-dashboard-header">
        <div>
          <span className="role-dashboard-eyebrow">Doctor / Profile</span>
          <h1>Profile &amp; settings</h1>
          <p>Manage your doctor profile and account password.</p>
        </div>
      </header>

      {error && <div className="admin-feedback admin-feedback-error" role="alert"><CircleAlert aria-hidden="true" />{error}</div>}

      <NotificationPreferences />

      <section className="card care-page-panel">
        <span className="role-dashboard-eyebrow">Your account</span>
        <h2>Account information</h2>
        <div className="doctor-form-grid">
          <div>
            <div style={{ fontSize: "12px", fontWeight: 700, color: "var(--color-text-muted)", textTransform: "uppercase" }}>Role</div>
            <div style={{ fontWeight: 600, marginTop: "4px" }}>{user?.role}</div>
          </div>
          <div>
            <div style={{ fontSize: "12px", fontWeight: 700, color: "var(--color-text-muted)", textTransform: "uppercase" }}>Email</div>
            <div style={{ fontWeight: 600, marginTop: "4px" }}>{user?.email}</div>
          </div>
        </div>
      </section>

      <section className="card care-page-panel">
        <span className="role-dashboard-eyebrow">Professional details</span>
        <h2>Doctor profile</h2>
        {profileMessage && <div className="admin-feedback admin-feedback-success" role="status"><CheckCircle2 aria-hidden="true" />{profileMessage}</div>}
        <form onSubmit={handleSaveProfile} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div className="doctor-form-grid">
            <div>
              <label htmlFor="doctor-first-name" style={{ display: "block", fontSize: "14px", fontWeight: 500, marginBottom: "6px" }}>First Name</label>
              <input id="doctor-first-name" className="input" name="firstName" autoComplete="given-name" value={profile.firstName || ""} onChange={handleProfileChange} />
            </div>
            <div>
              <label htmlFor="doctor-last-name" style={{ display: "block", fontSize: "14px", fontWeight: 500, marginBottom: "6px" }}>Last Name</label>
              <input id="doctor-last-name" className="input" name="lastName" autoComplete="family-name" value={profile.lastName || ""} onChange={handleProfileChange} />
            </div>
          </div>
          <div>
            <label htmlFor="doctor-specialization" style={{ display: "block", fontSize: "14px", fontWeight: 500, marginBottom: "6px" }}>Specialization</label>
            <input id="doctor-specialization" className="input" name="specialization" value={profile.specialization || ""} onChange={handleProfileChange} />
          </div>
          <div className="doctor-form-grid">
            <div>
              <label htmlFor="doctor-license" style={{ display: "block", fontSize: "14px", fontWeight: 500, marginBottom: "6px" }}>License Number</label>
              <input id="doctor-license" className="input" name="licenseNumber" value={profile.licenseNumber || ""} onChange={handleProfileChange} />
            </div>
            <div>
              <label htmlFor="doctor-contact" style={{ display: "block", fontSize: "14px", fontWeight: 500, marginBottom: "6px" }}>Contact Number</label>
              <input id="doctor-contact" className="input" name="contactNumber" autoComplete="tel" value={profile.contactNumber || ""} onChange={handleProfileChange} />
            </div>
          </div>
          <div>
            <label htmlFor="doctor-schedule" style={{ display: "block", fontSize: "14px", fontWeight: 500, marginBottom: "6px" }}>Clinic Schedule</label>
            <input id="doctor-schedule" className="input" name="clinicSchedule" value={profile.clinicSchedule || ""} onChange={handleProfileChange} />
          </div>
          <button type="submit" className="btn btn-primary" disabled={savingProfile} style={{ alignSelf: "flex-start", minWidth: "130px" }}>
            {savingProfile ? <><span className="spinner spinner-white" style={{ width: "16px", height: "16px" }} aria-hidden="true" />Saving…</> : "Save Profile"}
          </button>
        </form>
      </section>

      <section className="card care-page-panel">
        <span className="role-dashboard-eyebrow">Security</span>
        <h2>Change password</h2>
        {passwordMessage && <div className="admin-feedback admin-feedback-success" role="status"><CheckCircle2 aria-hidden="true" />{passwordMessage}</div>}
        <form onSubmit={handleChangePassword} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div>
            <label htmlFor="doctor-current-password" style={{ display: "block", fontSize: "14px", fontWeight: 500, marginBottom: "6px" }}>Current Password</label>
            <input id="doctor-current-password" type="password" className="input" autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} required />
          </div>
          <div className="doctor-form-grid">
            <div>
              <label htmlFor="doctor-new-password" style={{ display: "block", fontSize: "14px", fontWeight: 500, marginBottom: "6px" }}>New Password</label>
              <input id="doctor-new-password" type="password" className="input" autoComplete="new-password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} minLength={8} required />
            </div>
            <div>
              <label htmlFor="doctor-confirm-password" style={{ display: "block", fontSize: "14px", fontWeight: 500, marginBottom: "6px" }}>Confirm New Password</label>
              <input id="doctor-confirm-password" type="password" className="input" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} minLength={8} required />
            </div>
          </div>
          <button type="submit" className="btn btn-primary" disabled={savingPassword} style={{ alignSelf: "flex-start", minWidth: "150px" }}>
            {savingPassword ? <><span className="spinner spinner-white" style={{ width: "16px", height: "16px" }} aria-hidden="true" />Updating…</> : "Update Password"}
          </button>
        </form>
      </section>
    </div>
  );
}
