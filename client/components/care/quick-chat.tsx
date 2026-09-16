"use client";

import { useEffect, useState } from "react";
import { api, ApiError, type ApiPatient } from "@/lib/api";
import { ChatPanel } from "@/components/care/chat-panel";
import { ArrowLeft, ChevronRight, MessageCircle, X } from "lucide-react";

function patientName(patient: ApiPatient) {
  return [patient.profile?.firstName, patient.profile?.lastName].filter(Boolean).join(" ") || patient.email;
}

export function QuickChat({ role }: { role: "patient" | "doctor" }) {
  const [isOpen, setIsOpen] = useState(false);
  const [patients, setPatients] = useState<ApiPatient[] | null>(null);
  const [selectedPatient, setSelectedPatient] = useState<ApiPatient | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isOpen || role !== "doctor" || patients !== null) return;

    api.getPatients()
      .then((result) => {
        setPatients(result.patients.filter((patient) => patient.isActive && !patient.archivedAt));
        setError("");
      })
      .catch((err) => {
        setPatients([]);
        setError(err instanceof ApiError ? err.message : "Unable to load patients.");
      });
  }, [isOpen, patients, role]);

  useEffect(() => {
    if (!isOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [isOpen]);

  return (
    <div className="quick-chat">
      {isOpen && (
        <div className="quick-chat-drawer" role="dialog" aria-modal="false" aria-label="Messages">
          <div className="quick-chat-toolbar">
            {role === "doctor" && selectedPatient ? (
              <button type="button" className="quick-chat-toolbar-button" onClick={() => setSelectedPatient(null)} aria-label="Back to patients">
                <ArrowLeft size={18} aria-hidden="true" /> Patients
              </button>
            ) : (
              <div className="quick-chat-toolbar-title">
                <span className="quick-chat-toolbar-icon"><MessageCircle size={18} aria-hidden="true" /></span>
                <div><strong>Messages</strong><small>{role === "doctor" ? "Patient conversations" : "Your care team"}</small></div>
              </div>
            )}
            <button type="button" className="quick-chat-close" onClick={() => setIsOpen(false)} aria-label="Close messages"><X size={19} aria-hidden="true" /></button>
          </div>

          {role === "patient" ? (
            <ChatPanel role="patient" counterpartName="your doctor" compact />
          ) : selectedPatient ? (
            <ChatPanel role="doctor" patientUserId={selectedPatient.id} counterpartName={patientName(selectedPatient)} compact />
          ) : (
            <div className="quick-chat-patient-list">
              <p className="quick-chat-help">Choose a patient to open the conversation.</p>
              {error && <div className="quick-chat-error" role="alert">{error}</div>}
              {patients === null ? (
                <div className="quick-chat-empty">Loading patients…</div>
              ) : patients.length === 0 ? (
                <div className="quick-chat-empty">No active patients are assigned to you.</div>
              ) : patients.map((patient) => (
                <button key={patient.id} type="button" className="quick-chat-patient" onClick={() => setSelectedPatient(patient)}>
                  <span className="quick-chat-avatar">{patientName(patient).charAt(0).toUpperCase()}</span>
                  <span>
                    <strong>{patientName(patient)}</strong>
                    <small>{patient.email}</small>
                  </span>
                  <ChevronRight className="quick-chat-patient-arrow" size={18} aria-hidden="true" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <button type="button" className="quick-chat-trigger" onClick={() => setIsOpen((current) => !current)} aria-expanded={isOpen} aria-label={isOpen ? "Close messages" : "Open messages"} title={isOpen ? "Close messages" : "Messages"}>
        {isOpen ? <X size={27} aria-hidden="true" /> : <MessageCircle size={29} strokeWidth={2.1} aria-hidden="true" />}
      </button>
    </div>
  );
}
