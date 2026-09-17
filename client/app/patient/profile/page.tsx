"use client";

import { useEffect, useState } from "react";
import { ChevronDown, CircleAlert, LoaderCircle, LockKeyhole, Mail, ShieldCheck, Stethoscope, UserRound } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { api, ApiError, type ConsentSettings, type PatientProfile } from "@/lib/api";
import { PatientProfileForm } from "@/components/patient/patient-profile-form";
import { NotificationPreferences } from "@/components/care/notification-preferences";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function PatientProfilePage() {
  const { user, refreshUser } = useAuth();
  const [profile, setProfile] = useState<Partial<PatientProfile> | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [savingConsent, setSavingConsent] = useState(false);
  const [error, setError] = useState("");
  const [profileMessage, setProfileMessage] = useState("");
  const [consentMessage, setConsentMessage] = useState("");
  const [passwordMessage, setPasswordMessage] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [consent, setConsent] = useState<ConsentSettings | null>(null);

  useEffect(() => {
    let mounted = true;
    Promise.all([api.getProfile(), api.getMyConsent()])
      .then(([res, consentRes]) => {
        if (mounted) {
          setProfile((res.user.profile as PatientProfile) ?? {});
          setConsent(consentRes.consent);
        }
      })
      .catch((err) => { if (mounted) setError(err instanceof ApiError ? err.message : "Failed to load profile."); })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, []);

  const handleSaveProfile = async (data: Partial<PatientProfile>) => {
    setSavingProfile(true);
    setError("");
    setProfileMessage("");
    try {
      const res = await api.updateProfile(data);
      setProfile((res.user.profile as PatientProfile) ?? {});
      setProfileMessage("Your personal information was saved.");
      await refreshUser();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to update profile.");
    } finally {
      setSavingProfile(false);
    }
  };

  const handleSaveConsent = async () => {
    if (!consent) return;
    setSavingConsent(true);
    setError("");
    setConsentMessage("");
    try {
      const result = await api.updateMyConsent(Boolean(consent.privacyConsentAt), Boolean(consent.recordingConsentAt));
      setConsent(result.consent);
      setConsentMessage("Your camera and privacy choices were saved.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to update consent.");
    } finally {
      setSavingConsent(false);
    }
  };

  const handleChangePassword = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setPasswordMessage("");
    if (newPassword !== confirmPassword) { setError("New passwords do not match."); return; }
    if (currentPassword === newPassword) { setError("New password must be different from your current password."); return; }

    setSavingPassword(true);
    try {
      await api.changePassword(currentPassword, newPassword);
      setPasswordMessage("Your password was changed.");
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
    return <div className="patient-page-loading" role="status"><LoaderCircle className="recorder-spin" aria-hidden="true" /><span>Loading your profile…</span></div>;
  }

  const doctorName = [profile?.assignedDoctor?.firstName, profile?.assignedDoctor?.lastName].filter(Boolean).join(" ");

  return (
    <div className="patient-page patient-profile-page animate-fade-in">
      <header className="patient-page-header">
        <div><span className="patient-page-eyebrow">Your account</span><h1>Profile & settings</h1></div>
      </header>

      {error && <div className="patient-page-alert" role="alert"><CircleAlert /><span>{error}</span></div>}

      <div className="patient-profile-grid">
        <Card className="patient-profile-main-card">
          <CardHeader>
            <div className="patient-settings-heading"><span><UserRound /></span><div><CardTitle>Personal information</CardTitle></div></div>
          </CardHeader>
          <CardContent className="patient-profile-form-content">
            {profileMessage && <div className="patient-settings-success" role="status"><ShieldCheck aria-hidden="true" /> {profileMessage}</div>}
            <PatientProfileForm initialData={profile} onSave={handleSaveProfile} isLoading={savingProfile} />
          </CardContent>
        </Card>

        <aside className="patient-profile-side">
          <Card className="patient-account-card">
            <CardHeader><CardTitle>Account</CardTitle></CardHeader>
            <CardContent>
              <div className="patient-account-line"><span><Mail /></span><div><small>Email</small><strong>{user?.email}</strong></div></div>
              <div className="patient-account-line">
                <span><Stethoscope /></span>
                <div>
                  <small>Your doctor</small>
                  <strong>{doctorName ? `Dr. ${doctorName}` : "Not assigned yet"}</strong>
                  {profile?.assignedDoctor?.specialization && (
                    <span style={{ fontSize: "12px", color: "var(--color-text-muted)", display: "block", marginTop: "1px" }}>
                      {profile.assignedDoctor.specialization}
                    </span>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="patient-consent-card">
            <CardHeader>
              <div className="patient-settings-heading"><span><ShieldCheck /></span><div><CardTitle>Camera & privacy</CardTitle></div></div>
            </CardHeader>
            <CardContent>
              <label className="patient-setting-choice"><input type="checkbox" checked={Boolean(consent?.privacyConsentAt)} onChange={(event) => setConsent((current) => ({ privacyConsentAt: event.target.checked ? new Date().toISOString() : null, recordingConsentAt: event.target.checked ? current?.recordingConsentAt ?? null : null }))} /><span><strong>Use my rehabilitation data</strong><small>Allows movement evaluation and progress tracking.</small></span></label>
              <label className="patient-setting-choice"><input type="checkbox" checked={Boolean(consent?.recordingConsentAt)} disabled={!consent?.privacyConsentAt} onChange={(event) => setConsent((current) => ({ privacyConsentAt: current?.privacyConsentAt ?? null, recordingConsentAt: event.target.checked ? new Date().toISOString() : null }))} /><span><strong>Allow exercise recording</strong><small>Lets the recorder ask for browser camera access.</small></span></label>
              {consentMessage && <div className="patient-settings-success" role="status"><ShieldCheck aria-hidden="true" /> {consentMessage}</div>}
              <Button onClick={handleSaveConsent} disabled={savingConsent || !consent}>{savingConsent ? <LoaderCircle className="recorder-spin" /> : <ShieldCheck />} Save choices</Button>
            </CardContent>
          </Card>

          <div className="patient-notification-preferences-wrap"><NotificationPreferences /></div>

          <details className="patient-security-card">
            <summary><span><LockKeyhole /></span><span><strong>Password</strong></span><ChevronDown /></summary>
            <form onSubmit={handleChangePassword}>
              {passwordMessage && <div className="patient-settings-success" role="status"><ShieldCheck aria-hidden="true" /> {passwordMessage}</div>}
              <label>Current password<input type="password" className="input" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} required /></label>
              <label>New password<input type="password" className="input" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} minLength={8} required /></label>
              <label>Confirm new password<input type="password" className="input" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} minLength={8} required /></label>
              <Button type="submit" disabled={savingPassword}>{savingPassword ? <LoaderCircle className="recorder-spin" /> : <LockKeyhole />} Update password</Button>
            </form>
          </details>
        </aside>
      </div>
    </div>
  );
}
