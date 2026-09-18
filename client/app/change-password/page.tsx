"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { HeartPulse, LockKeyhole } from "lucide-react";
import { useAuth, ROLE_DASHBOARDS, type UserRole } from "@/lib/auth-context";
import { api, ApiError } from "@/lib/api";

export default function ChangePasswordPage() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { user, refreshUser, logout } = useAuth();
  const router = useRouter();

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");

    if (newPassword !== confirmPassword) {
      setError("New passwords do not match.");
      return;
    }
    if (newPassword.length < 8) {
      setError("New password must be at least 8 characters.");
      return;
    }
    if (currentPassword === newPassword) {
      setError("New password must be different from your current password.");
      return;
    }

    setIsSubmitting(true);
    try {
      await api.changePassword(currentPassword, newPassword);
      await refreshUser();
      router.push(user ? ROLE_DASHBOARDS[user.role as UserRole] : "/");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "An unexpected error occurred. Please try again.");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="auth-page">
      <header className="auth-topbar">
        <div className="auth-brand"><HeartPulse aria-hidden="true" /><span>MediRehab <strong>AI</strong></span></div>
        <button type="button" className="btn btn-secondary" onClick={logout}>Sign out</button>
      </header>

      <main className="auth-main">
        <section className="auth-card auth-card-narrow animate-slide-up" aria-labelledby="change-password-title">
          <div className="auth-card-header">
            <span className="auth-eyebrow"><LockKeyhole aria-hidden="true" /> Account security</span>
            <h1 id="change-password-title">Password change required</h1>
            <p>Change your temporary password before continuing to your dashboard.</p>
          </div>
          <div className="auth-card-body">
            {error && <div role="alert" className="auth-error animate-fade-in">{error}</div>}
            <form onSubmit={handleSubmit} className="auth-form">
              <div>
                <label htmlFor="current-password">Current password</label>
                <input id="current-password" type="password" className="input" placeholder="Enter your temporary password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} required autoComplete="current-password" autoFocus />
              </div>
              <div>
                <label htmlFor="new-password">New password</label>
                <input id="new-password" type="password" className="input" placeholder="At least 8 characters" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} required autoComplete="new-password" minLength={8} />
              </div>
              <div>
                <label htmlFor="confirm-password">Confirm new password</label>
                <input id="confirm-password" type="password" className="input" placeholder="Re-enter your new password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required autoComplete="new-password" minLength={8} />
              </div>
              <button type="submit" id="change-password-submit" className="btn btn-primary btn-full" disabled={isSubmitting}>
                {isSubmitting ? <><span className="spinner spinner-white" aria-hidden="true" /> Changing password…</> : "Change password"}
              </button>
            </form>
          </div>
        </section>
      </main>
    </div>
  );
}
