"use client";

import { useEffect, useState } from "react";
import { api, type NotificationPreferences as Preferences } from "@/lib/api";

export function NotificationPreferences() {
  const [preferences, setPreferences] = useState<Preferences | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => { void api.getNotificationPreferences().then((result) => setPreferences(result.preferences)); }, []);
  if (!preferences) return null;
  return <section className="card" style={{ padding: "24px" }}><h2 style={{ fontSize: "18px", fontWeight: 600, margin: "0 0 10px" }}>Notification Preferences</h2>
    <label style={{ display: "flex", gap: "10px", margin: "12px 0" }}><input type="checkbox" checked={preferences.chatNotificationsEnabled} onChange={(event) => setPreferences({ ...preferences, chatNotificationsEnabled: event.target.checked })} /> New chat-message notifications</label>
    <label style={{ display: "flex", gap: "10px", margin: "12px 0" }}><input type="checkbox" checked={preferences.careNotificationsEnabled} onChange={(event) => setPreferences({ ...preferences, careNotificationsEnabled: event.target.checked })} /> Care-plan, result, check-in, and help notifications</label>
    {saved && <div style={{ color: "#166534", fontSize: "13px", marginBottom: "8px" }}>Preferences saved.</div>}
    <button className="btn btn-primary" disabled={busy} onClick={async () => { setBusy(true); setSaved(false); try { const result = await api.updateNotificationPreferences(preferences.chatNotificationsEnabled, preferences.careNotificationsEnabled); setPreferences(result.preferences); setSaved(true); } finally { setBusy(false); } }}>{busy ? "Saving…" : "Save preferences"}</button>
  </section>;
}
