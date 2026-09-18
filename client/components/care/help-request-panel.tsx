"use client";

import { useState } from "react";
import { api, ApiError, type ExerciseAssignment } from "@/lib/api";

export function HelpRequestPanel({ assignments }: { assignments: ExerciseAssignment[] }) {
  const [message, setMessage] = useState("");
  const [assignmentId, setAssignmentId] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  return <section className="card" style={{ padding: "24px", borderColor: "#FCA5A5" }}>
    <h2 style={{ fontSize: "18px", fontWeight: 600, margin: "0 0 6px" }}>Need help?</h2>
    <p style={{ color: "var(--color-text-secondary)", fontSize: "14px", margin: "0 0 14px" }}>Send a priority request to your assigned doctor. For emergencies, contact local emergency services.</p>
    {status && <div style={{ padding: "10px 12px", marginBottom: "10px", borderRadius: "var(--radius-md)", backgroundColor: status.startsWith("Sent") ? "#DCFCE7" : "#FEE2E2", fontSize: "13px" }}>{status}</div>}
    <form onSubmit={async (event) => {
      event.preventDefault();
      if (!message.trim()) return;
      setBusy(true);
      try {
        await api.requestHelp(message.trim(), assignmentId || undefined);
        setMessage(""); setAssignmentId(""); setStatus("Sent to your doctor.");
      } catch (error) { setStatus(error instanceof ApiError ? error.message : "Unable to send request."); }
      finally { setBusy(false); }
    }} style={{ display: "grid", gap: "10px" }}>
      <select className="input" value={assignmentId} onChange={(event) => setAssignmentId(event.target.value)}><option value="">General concern</option>{assignments.map((assignment) => <option key={assignment.id} value={assignment.id}>{assignment.exercise.name}</option>)}</select>
      <textarea className="input" maxLength={1000} value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Tell your doctor what you need help with" style={{ minHeight: "80px", paddingTop: "10px" }} />
      <div><button className="btn btn-danger" type="submit" disabled={busy || !message.trim()}>{busy ? "Sending…" : "Request help"}</button></div>
    </form>
  </section>;
}
