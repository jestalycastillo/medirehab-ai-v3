"use client";

import { useEffect, useState } from "react";
import { api, ApiError, type ApiPatient, type PatientProfile } from "@/lib/api";
import { ChatPanel } from "@/components/care/chat-panel";

function MessageIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z" />
    </svg>
  );
}

function patientName(patient: ApiPatient) {
  return [patient.profile?.firstName, patient.profile?.lastName].filter(Boolean).join(" ") || patient.email;
}

export function QuickChat({ role }: { role: "patient" | "doctor" }) {
  const [isOpen, setIsOpen] = useState(false);
  const [patients, setPatients] = useState<ApiPatient[] | null>(null);
  const [selectedPatient, setSelectedPatient] = useState<ApiPatient | null>(null);
  const [doctorName, setDoctorName] = useState("Your Doctor");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isOpen) return;

    if (role === "doctor" && patients === null) {
      api.getPatients()
        .then((result) => {
          setPatients(result.patients.filter((patient) => patient.isActive && !patient.archivedAt));
          setError("");
        })
        .catch((err) => {
          setPatients([]);
          setError(err instanceof ApiError ? err.message : "Unable to load patients.");
        });
    }

    if (role === "patient") {
      api.getProfile()
        .then((result) => {
          const doc = (result.user?.profile as PatientProfile | undefined)?.assignedDoctor;
          const name = [doc?.firstName, doc?.lastName].filter(Boolean).join(" ");
          if (name) setDoctorName(`Dr. ${name}`);
        })
        .catch(() => {});
    }
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
        <div className="quick-chat-drawer" role="dialog" aria-modal="false" aria-label="Quick messages">
          <div className="quick-chat-toolbar">
            {role === "doctor" && selectedPatient ? (
              <button type="button" className="quick-chat-toolbar-button" onClick={() => setSelectedPatient(null)} aria-label="Back to patients">
                ← Patients
              </button>
            ) : (
              <strong>Quick messages</strong>
            )}
            <button type="button" className="quick-chat-close" onClick={() => setIsOpen(false)} aria-label="Close messages">×</button>
          </div>

          {role === "patient" ? (
            <ChatPanel role="patient" counterpartName={doctorName} compact />
          ) : selectedPatient ? (
            <ChatPanel role="doctor" patientUserId={selectedPatient.id} counterpartName={patientName(selectedPatient)} compact />
          ) : (
            <div className="quick-chat-patient-list">
              {error && <div className="quick-chat-error">{error}</div>}
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
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <button type="button" className="quick-chat-trigger" onClick={() => setIsOpen((current) => !current)} aria-expanded={isOpen} aria-label={isOpen ? "Close messages" : "Open quick messages"}>
        <MessageIcon />
        <span>{isOpen ? "Close" : "Messages"}</span>
      </button>
    </div>
  );
}
