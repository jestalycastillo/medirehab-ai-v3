"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { api, ApiError, type ConsentSettings, type PatientProfile } from "@/lib/api";
import { PatientProfileForm } from "@/components/patient/patient-profile-form";

export default function PatientProfilePage() {
  const { user, refreshUser } = useAuth();
  const [profile, setProfile] = useState<Partial<PatientProfile> | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [error, setError] = useState("");
  const [profileMessage, setProfileMessage] = useState("");
  const [passwordMessage, setPasswordMessage] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [consent, setConsent] = useState<ConsentSettings | null>(null);
  const [savingConsent, setSavingConsent] = useState(false);

  useEffect(() => {
    let mounted = true;
    Promise.all([api.getProfile(), api.getMyConsent()])
      .then(([res, consentRes]) => {
        if (mounted) { setProfile((res.user.profile as PatientProfile) ?? {}); setConsent(consentRes.consent); }
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

  const handleSaveProfile = async (data: Partial<PatientProfile>) => {
    setSavingProfile(true);
    setError("");
    setProfileMessage("");
    try {
      const res = await api.updateProfile(data);
      setProfile((res.user.profile as PatientProfile) ?? {});
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

  if (loading) {
    return <div style={{ display: "flex", justifyContent: "center", padding: "80px" }}><div className="spinner" /></div>;
  }

  return (
    <div className="animate-fade-in" style={{ display: "flex", flexDirection: "column", gap: "24px", maxWidth: "760px" }}>
      <div>
        <h1 style={{ fontSize: "28px", fontWeight: 700, margin: "0 0 8px 0" }}>Profile</h1>
        <p style={{ color: "var(--color-text-secondary)", margin: 0 }}>
          Manage your patient profile and account password.
        </p>
      </div>

      {error && (
        <div style={{ padding: "14px 16px", backgroundColor: "#FEF2F2", color: "var(--color-danger)", borderRadius: "var(--radius-md)" }}>
          {error}
        </div>
      )}

      <section className="card" style={{ padding: "24px" }}>
        <h2 style={{ fontSize: "18px", fontWeight: 600, margin: "0 0 18px 0" }}>Account Information</h2>
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

      <section className="card" style={{ padding: "24px" }}>
        <h2 style={{ fontSize: "18px", fontWeight: 600, margin: "0 0 18px 0" }}>Patient Profile</h2>
        {profileMessage && (
          <div style={{ padding: "12px 16px", backgroundColor: "#DCFCE7", color: "#166534", borderRadius: "var(--radius-md)", marginBottom: "18px" }}>
            {profileMessage}
          </div>
        )}
        <PatientProfileForm initialData={profile} onSave={handleSaveProfile} isLoading={savingProfile} />
      </section>

      <section className="card" style={{ padding: "24px" }}>
        <h2 style={{ fontSize: "18px", fontWeight: 600, margin: "0 0 10px" }}>Privacy & Recording Consent</h2>
        <p style={{ color: "var(--color-text-secondary)", fontSize: "14px" }}>Exercise video is processed for evaluation and is not stored by the Node server. You can revoke future processing consent here.</p>
        <label style={{ display: "flex", gap: "10px", margin: "12px 0" }}><input type="checkbox" checked={Boolean(consent?.privacyConsentAt)} onChange={(event) => setConsent((current) => ({ privacyConsentAt: event.target.checked ? new Date().toISOString() : null, recordingConsentAt: event.target.checked ? current?.recordingConsentAt ?? null : null }))} /> I consent to processing my rehabilitation data.</label>
        <label style={{ display: "flex", gap: "10px", margin: "12px 0" }}><input type="checkbox" checked={Boolean(consent?.recordingConsentAt)} disabled={!consent?.privacyConsentAt} onChange={(event) => setConsent((current) => ({ privacyConsentAt: current?.privacyConsentAt ?? null, recordingConsentAt: event.target.checked ? new Date().toISOString() : null }))} /> I consent to camera recording for exercise evaluation.</label>
        <button className="btn btn-primary" disabled={savingConsent || !consent} onClick={async () => { if (!consent) return; setSavingConsent(true); try { const result = await api.updateMyConsent(Boolean(consent.privacyConsentAt), Boolean(consent.recordingConsentAt)); setConsent(result.consent); setProfileMessage("Consent settings updated."); } catch (err) { setError(err instanceof ApiError ? err.message : "Unable to update consent."); } finally { setSavingConsent(false); } }}>{savingConsent ? "Saving…" : "Save consent"}</button>
      </section>

      <section className="card" style={{ padding: "24px" }}>
        <h2 style={{ fontSize: "18px", fontWeight: 600, margin: "0 0 18px 0" }}>Change Password</h2>
        {passwordMessage && (
          <div style={{ padding: "12px 16px", backgroundColor: "#DCFCE7", color: "#166534", borderRadius: "var(--radius-md)", marginBottom: "18px" }}>
            {passwordMessage}
          </div>
        )}
        <form onSubmit={handleChangePassword} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div>
            <label style={{ display: "block", fontSize: "14px", fontWeight: 500, marginBottom: "6px" }}>Current Password</label>
            <input type="password" className="input" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} required />
          </div>
          <div className="doctor-form-grid">
            <div>
              <label style={{ display: "block", fontSize: "14px", fontWeight: 500, marginBottom: "6px" }}>New Password</label>
              <input type="password" className="input" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} minLength={8} required />
            </div>
            <div>
              <label style={{ display: "block", fontSize: "14px", fontWeight: 500, marginBottom: "6px" }}>Confirm New Password</label>
              <input type="password" className="input" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} minLength={8} required />
            </div>
          </div>
          <button type="submit" className="btn btn-primary" disabled={savingPassword} style={{ alignSelf: "flex-start", minWidth: "150px" }}>
            {savingPassword ? <div className="spinner spinner-white" style={{ width: "16px", height: "16px" }} /> : "Update Password"}
          </button>
        </form>
      </section>
    </div>
  );
}
