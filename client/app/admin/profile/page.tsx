"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { api, ApiError } from "@/lib/api";

export default function AdminProfilePage() {
  const { user } = useAuth();
  
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (newPassword !== confirmPassword) {
      setError("New passwords do not match.");
      return;
    }

    if (newPassword.length < 8) {
      setError("New password must be at least 8 characters long.");
      return;
    }

    if (currentPassword === newPassword) {
      setError("New password must be different from your current password.");
      return;
    }

    setLoading(true);
    try {
      await api.changePassword(currentPassword, newPassword);
      setSuccess("Password changed successfully.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Failed to change password. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="role-dashboard admin-subpage animate-fade-in">
      <header className="role-dashboard-header">
        <div>
          <span className="role-dashboard-eyebrow">Admin / Profile</span>
          <h1>Settings &amp; profile</h1>
          <p>Review your account details and manage your password.</p>
        </div>
      </header>

      <div className="admin-profile-grid">
        <section className="card admin-subpage-panel admin-profile-card" aria-labelledby="admin-account-heading">
          <span className="role-dashboard-eyebrow">Your account</span>
          <h2 id="admin-account-heading">Account information</h2>
          <dl className="admin-profile-details">
            <div><dt>Role</dt><dd>{user?.role || "—"}</dd></div>
            <div><dt>Email address</dt><dd>{user?.email || "—"}</dd></div>
          </dl>
        </section>

        <section className="card admin-subpage-panel admin-profile-card" aria-labelledby="admin-password-heading">
          <span className="role-dashboard-eyebrow">Security</span>
          <h2 id="admin-password-heading">Change password</h2>
          <p className="admin-profile-intro">Choose a new password for your administrator account.</p>

          {error && <div className="admin-profile-message admin-profile-message-error" role="alert">{error}</div>}
          {success && <div className="admin-profile-message admin-profile-message-success" role="status">{success}</div>}

          <form onSubmit={handleChangePassword} className="admin-profile-form">
            <div>
              <label htmlFor="admin-current-password">Current password</label>
              <input id="admin-current-password" type="password" className="input" autoComplete="current-password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required />
            </div>
            <div>
              <label htmlFor="admin-new-password">New password</label>
              <input id="admin-new-password" type="password" className="input" autoComplete="new-password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required minLength={8} />
            </div>
            <div>
              <label htmlFor="admin-confirm-password">Confirm new password</label>
              <input id="admin-confirm-password" type="password" className="input" autoComplete="new-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required minLength={8} />
            </div>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? <div className="spinner spinner-white" style={{ width: "16px", height: "16px" }} /> : "Update password"}
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}
