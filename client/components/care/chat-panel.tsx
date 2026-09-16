"use client";

import { useEffect, useRef, useState } from "react";
import { api, ApiError, type ChatMessage } from "@/lib/api";

const POLL_INTERVAL_MS = 2_000;

function formatTime(value: string) {
  return new Intl.DateTimeFormat("en", { hour: "numeric", minute: "2-digit" }).format(new Date(value));
}

export function ChatPanel({
  role,
  patientUserId,
  counterpartName,
  compact = false,
}: {
  role: "patient" | "doctor";
  patientUserId?: string;
  counterpartName: string;
  compact?: boolean;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [counterpartLastSeenAt, setCounterpartLastSeenAt] = useState<string | null>(null);
  const [lastPolledAt, setLastPolledAt] = useState<number | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const messageCountRef = useRef(0);

  const loadMessages = async (initial = false) => {
    try {
      const result = await api.getChatMessages(patientUserId);
      setMessages(result.messages);
      setCounterpartLastSeenAt(result.counterpartLastSeenAt);
      setLastPolledAt(Date.now());
      const incomingRole = role === "patient" ? "DOCTOR" : "PATIENT";
      if (result.messages.some((message) => message.sender.role === incomingRole && !message.readAt)) {
        await api.markChatMessagesRead(patientUserId);
      }
      setError("");
      if (initial || result.messages.length > messageCountRef.current) {
        requestAnimationFrame(() => bottomRef.current?.scrollIntoView({ behavior: initial ? "auto" : "smooth", block: "end" }));
      }
      messageCountRef.current = result.messages.length;
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to load messages.");
    } finally {
      if (initial) setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadMessages(true);
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") void loadMessages();
    }, POLL_INTERVAL_MS);
    return () => window.clearInterval(interval);
    // patientUserId identifies the doctor-visible thread; patients use their assigned doctor.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientUserId, role]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const body = draft.trim();
    if (!body || sending) return;

    setSending(true);
    try {
      const result = await api.sendChatMessage(body, patientUserId);
      setMessages((current) => [...current, result.message]);
      setDraft("");
      requestAnimationFrame(() => bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to send message.");
    } finally {
      setSending(false);
    }
  };

  const isOnline = counterpartLastSeenAt !== null && lastPolledAt !== null && lastPolledAt - new Date(counterpartLastSeenAt).getTime() < 2 * 60_000;

  return (
    <section className={`card${compact ? " quick-chat-panel" : ""}`} style={{ padding: compact ? "16px" : "24px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "center", marginBottom: "16px" }}>
        <div>
          <h2 style={{ fontSize: "18px", fontWeight: 600, margin: 0 }}>{counterpartName}</h2>
          <p style={{ color: "var(--color-text-muted)", fontSize: "13px", margin: "4px 0 0", display: "flex", alignItems: "center", gap: "6px" }}>
            <span
              style={{
                width: "8px",
                height: "8px",
                borderRadius: "50%",
                backgroundColor: isOnline ? "#16a34a" : "#94a3b8",
                display: "inline-block",
              }}
            />
            {isOnline ? "Online" : "Offline"}
          </p>
        </div>
      </div>

      {error && <div style={{ marginBottom: "12px", padding: "10px 12px", borderRadius: "var(--radius-md)", backgroundColor: "#FEE2E2", color: "#991B1B", fontSize: "13px" }}>{error}</div>}

      <div aria-live="polite" style={{ minHeight: compact ? "160px" : "180px", maxHeight: compact ? "300px" : "360px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "10px", padding: "4px 2px 12px" }}>
        {loading ? <div style={{ color: "var(--color-text-muted)", padding: "32px 0", textAlign: "center" }}>Loading messages…</div> : messages.length === 0 ? <div style={{ color: "var(--color-text-muted)", padding: "32px 0", textAlign: "center" }}>Start the conversation with {counterpartName}.</div> : messages.map((message) => {
          const mine = role === "patient" ? message.sender.role === "PATIENT" : message.sender.role === "DOCTOR";
          return <div key={message.id} style={{ alignSelf: mine ? "flex-end" : "flex-start", maxWidth: "82%", padding: "10px 12px", borderRadius: "14px", backgroundColor: mine ? "var(--color-primary)" : "var(--color-page-bg)", color: mine ? "white" : "var(--color-text-primary)" }}>
            {!mine && <div style={{ fontSize: "12px", fontWeight: 700, marginBottom: "4px" }}>{message.sender.displayName}</div>}
            <div style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere", fontSize: "14px" }}>{message.body}</div>
            <div style={{ marginTop: "5px", fontSize: "11px", opacity: 0.72, textAlign: "right" }}>{formatTime(message.createdAt)}{mine && message.readAt ? " · Read" : ""}</div>
          </div>;
        })}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={submit} style={{ display: "flex", gap: "10px", borderTop: "1px solid var(--color-border)", paddingTop: "14px" }}>
        <textarea className="input" value={draft} maxLength={2000} rows={2} placeholder={`Message ${counterpartName}`} onChange={(event) => setDraft(event.target.value)} style={{ resize: "vertical", flex: 1, paddingTop: "10px" }} />
        <button className="btn btn-primary" type="submit" disabled={!draft.trim() || sending} style={{ alignSelf: "flex-end" }}>{sending ? "Sending…" : "Send"}</button>
      </form>
    </section>
  );
}
