"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Eye, EyeOff, HeartPulse, LockKeyhole, Mail } from "lucide-react";
import { useAuth, ROLE_DASHBOARDS, type UserRole } from "@/lib/auth-context";
import { ApiError } from "@/lib/api";

const ROLE_LABELS: Record<UserRole, string> = {
  ADMIN: "Administrator",
  DOCTOR: "Doctor",
  PATIENT: "Patient",
};

const ROLE_DESCRIPTIONS: Record<UserRole, string> = {
  ADMIN: "Manage care accounts and the exercise library.",
  DOCTOR: "Review patients and manage their exercise plans.",
  PATIENT: "See your care plan and track your recovery.",
};

export default function LoginForm({ expectedRole }: { expectedRole: UserRole }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { user, loading, login, logout } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading || !user) return;
    router.replace(user.mustChangePassword ? "/change-password" : ROLE_DASHBOARDS[user.role as UserRole]);
  }, [user, loading, router]);

  if (loading || user) {
    return <div className="auth-loading"><div className="spinner" aria-label="Loading sign in" /></div>;
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const result = await login(email, password);
      if (result.user.role !== expectedRole) {
        await logout();
        setError(`This sign in page is for ${ROLE_LABELS[expectedRole].toLowerCase()} accounts. Your account has the ${ROLE_LABELS[result.user.role as UserRole].toLowerCase()} role.`);
        setIsSubmitting(false);
        return;
      }
      router.push(result.mustChangePassword ? "/change-password" : ROLE_DASHBOARDS[result.user.role as UserRole]);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "An unexpected error occurred. Please try again.");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="auth-page">
      <header className="auth-topbar">
        <Link className="auth-brand" href="/"><HeartPulse aria-hidden="true" /><span>MediRehab <strong>AI</strong></span></Link>
      </header>

      <main className="auth-main">
        <div className="auth-login-grid">
          <div className="auth-hero animate-fade-in">
            <span className="auth-eyebrow">MediRehab AI</span>
            <h1>Smarter rehab.<br /><span>Faster recovery.</span></h1>
            <p>Stay connected to your care plan, your progress, and your care team.</p>
            <ul>
              {["Guided exercise sessions", "Progress you can follow", "Care tailored to you"].map((item) => (
                <li key={item}><Check aria-hidden="true" />{item}</li>
              ))}
            </ul>
          </div>

          <section className="auth-card animate-slide-up" aria-labelledby="login-title">
            <div className="auth-card-header">
              <span className="auth-eyebrow">{ROLE_LABELS[expectedRole]} portal</span>
              <h2 id="login-title">Sign in</h2>
              <p>{ROLE_DESCRIPTIONS[expectedRole]}</p>
            </div>
            <div className="auth-card-body">
              {error && <div role="alert" className="auth-error animate-fade-in">{error}</div>}
              <form onSubmit={handleSubmit} className="auth-form">
                <div>
                  <label htmlFor="login-email">Email address</label>
                  <div className="auth-input-wrap">
                    <Mail aria-hidden="true" />
                    <input id="login-email" type="email" className="input" placeholder="you@example.com" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="email" autoFocus />
                  </div>
                </div>
                <div>
                  <label htmlFor="login-password">Password</label>
                  <div className="auth-input-wrap auth-password-wrap">
                    <LockKeyhole aria-hidden="true" />
                    <input id="login-password" type={showPassword ? "text" : "password"} className="input" placeholder="Enter your password" value={password} onChange={(event) => setPassword(event.target.value)} required autoComplete="current-password" />
                    <button type="button" className="auth-password-toggle" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? "Hide password" : "Show password"}>
                      {showPassword ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
                    </button>
                  </div>
                </div>
                <button type="submit" id="login-submit" className="btn btn-primary btn-full" disabled={isSubmitting}>
                  {isSubmitting ? <><span className="spinner spinner-white" aria-hidden="true" /> Signing in…</> : "Sign in"}
                </button>
              </form>
            </div>
            {expectedRole !== "ADMIN" && <div className="auth-card-footer"><Link href="/">Back to homepage</Link></div>}
          </section>
        </div>
      </main>
      <footer className="auth-footer">© {new Date().getFullYear()} MediRehab AI. All rights reserved.</footer>
    </div>
  );
}
