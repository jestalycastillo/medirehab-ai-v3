"use client";

import { useState } from "react";
import { usePortalModalFocus } from "@/components/ui/use-portal-modal-focus";

function CopyIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

export function TemporaryPasswordDialog({
  isOpen,
  password,
  onClose,
}: {
  isOpen: boolean;
  password?: string;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const modalRef = usePortalModalFocus(isOpen && Boolean(password), onClose, false);

  if (!isOpen || !password) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(password).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="portal-modal-overlay">
      <div ref={modalRef} tabIndex={-1} className="portal-modal-panel portal-modal-password animate-slide-up" role="dialog" aria-modal="true" aria-labelledby="temporary-password-title">
        <div className="portal-modal-header">
          <span className="role-dashboard-eyebrow">Account created</span>
          <h2 id="temporary-password-title">Temporary password</h2>
          <p>Share this with the account holder so they can sign in.</p>
        </div>
        <div className="portal-modal-body">
        <div className="portal-modal-password-icon">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        </div>
        <p className="portal-modal-password-note">
          Please save this password. It will not be shown again. The user will be required to change it upon their first login.
        </p>

        <div className="portal-modal-password-value">
          <code>
            {password}
          </code>
          <button
            type="button" className="btn btn-secondary"
            onClick={handleCopy}
          >
            {copied ? <CheckIcon /> : <CopyIcon />}
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
        </div>
        <div className="portal-modal-footer">
        <button type="button" className="btn btn-primary" onClick={onClose}>
          I have saved it
        </button>
        </div>
      </div>
    </div>
  );
}
