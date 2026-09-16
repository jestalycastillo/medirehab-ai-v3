"use client";

import { useEffect, useRef, useState } from "react";
import { api, ApiError, type ChatMessage } from "@/lib/api";
import { MessageCircle, Search, Send } from "lucide-react";

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
  const [query, setQuery] = useState("");
  const [counterpartLastSeenAt, setCounterpartLastSeenAt] = useState<string | null>(null);
  const [lastPolledAt, setLastPolledAt] = useState<number | null>(null);
  const messagesRef = useRef<HTMLDivElement>(null);
  const messageCountRef = useRef(0);

  const scrollMessagesToBottom = (behavior: ScrollBehavior) => {
    requestAnimationFrame(() => {
      const container = messagesRef.current;
      container?.scrollTo({ top: container.scrollHeight, behavior });
    });
  };

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
        scrollMessagesToBottom(initial ? "instant" : "smooth");
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
      scrollMessagesToBottom("smooth");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to send message.");
    } finally {
      setSending(false);
    }
  };

  const visibleMessages = query.trim()
    ? messages.filter((message) => message.body.toLowerCase().includes(query.trim().toLowerCase()))
    : messages;
  const isOnline = counterpartLastSeenAt !== null && lastPolledAt !== null && lastPolledAt - new Date(counterpartLastSeenAt).getTime() < 2 * 60_000;

  return (
    <section className={`chat-panel${compact ? " quick-chat-panel" : ""}`} aria-label={`Conversation with ${counterpartName}`}>
      <div className="chat-panel-heading">
        <span className="chat-panel-avatar" aria-hidden="true">{counterpartName === "your doctor" ? "D" : counterpartName.charAt(0).toUpperCase()}</span>
        <div className="chat-panel-heading-copy">
          <h2>{counterpartName === "your doctor" ? "Your doctor" : counterpartName}</h2>
          <p><span className={`chat-panel-status-dot${isOnline ? " chat-panel-status-dot-online" : ""}`} aria-hidden="true" />{isOnline ? "Available now" : "Currently offline"}</p>
        </div>
      </div>

      {error && <div className="chat-panel-error" role="alert">{error}</div>}
      <label className="chat-panel-search">
        <Search size={17} aria-hidden="true" />
        <span className="sr-only">Search messages</span>
        <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search messages" />
      </label>

      <div ref={messagesRef} className="chat-panel-messages" aria-live="polite" aria-relevant="additions text">
        {loading ? <div className="chat-panel-empty">Loading messages…</div> : visibleMessages.length === 0 ? <div className="chat-panel-empty"><MessageCircle size={24} aria-hidden="true" /><strong>{messages.length ? "No matching messages" : "No messages yet"}</strong><span>{messages.length ? "Try a different search." : `Start the conversation with ${counterpartName}.`}</span></div> : visibleMessages.map((message) => {
          const mine = role === "patient" ? message.sender.role === "PATIENT" : message.sender.role === "DOCTOR";
          return <div key={message.id} className={`chat-message${mine ? " chat-message-mine" : ""}`}>
            {!mine && <strong className="chat-message-sender">{message.sender.displayName}</strong>}
            <div className="chat-message-body">{message.body}</div>
            <div className="chat-message-meta">{formatTime(message.createdAt)}{mine && message.readAt ? " · Read" : ""}</div>
          </div>;
        })}
      </div>

      <form className="chat-panel-composer" onSubmit={submit}>
        <label className="sr-only" htmlFor="chat-message-draft">Message {counterpartName}</label>
        <textarea id="chat-message-draft" value={draft} maxLength={2000} rows={2} placeholder={`Message ${counterpartName}…`} onChange={(event) => setDraft(event.target.value)} />
        <button type="submit" disabled={!draft.trim() || sending} aria-label={sending ? "Sending message" : "Send message"}>
          <Send size={18} aria-hidden="true" />
          <span>{sending ? "Sending…" : "Send"}</span>
        </button>
      </form>
    </section>
  );
}
