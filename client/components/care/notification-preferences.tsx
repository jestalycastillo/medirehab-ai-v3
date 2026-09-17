"use client";

import { useEffect, useState } from "react";
import { Bell, LoaderCircle, Save } from "lucide-react";
import { api, ApiError, type NotificationPreferences as Preferences } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function NotificationPreferences() {
  const [preferences, setPreferences] = useState<Preferences | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const retryLoad = async () => {
    setError("");
    try {
      const result = await api.getNotificationPreferences();
      setPreferences(result.preferences);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to load notification choices.");
    }
  };
  useEffect(() => {
    let mounted = true;
    void api.getNotificationPreferences()
      .then((result) => { if (mounted) setPreferences(result.preferences); })
      .catch((err) => { if (mounted) setError(err instanceof ApiError ? err.message : "Unable to load notification choices."); });
    return () => { mounted = false; };
  }, []);
  if (!preferences && !error) return <div className="patient-page-loading" role="status">Loading notification choices…</div>;
  return <Card className="patient-preferences-card">
    <CardHeader><div className="patient-settings-heading"><span><Bell /></span><div><CardTitle>Notifications</CardTitle></div></div></CardHeader>
    <CardContent>
      {error && <div className="admin-feedback admin-feedback-error" role="alert">{error}</div>}
      {!preferences && error && <Button variant="outline" onClick={() => void retryLoad()}>Try again</Button>}
      {preferences && <>
        <label className="patient-setting-choice"><input type="checkbox" checked={preferences.chatNotificationsEnabled} onChange={(event) => setPreferences({ ...preferences, chatNotificationsEnabled: event.target.checked })} /><span><strong>Chat messages</strong><small>Alerts for new messages from your care team.</small></span></label>
        <label className="patient-setting-choice"><input type="checkbox" checked={preferences.careNotificationsEnabled} onChange={(event) => setPreferences({ ...preferences, careNotificationsEnabled: event.target.checked })} /><span><strong>Care updates</strong><small>Plans, results, check-ins, and help requests.</small></span></label>
        {saved && <div className="patient-settings-success" role="status"><Save aria-hidden="true" /> Notification choices saved.</div>}
        <Button disabled={busy} onClick={async () => { setBusy(true); setSaved(false); setError(""); try { const result = await api.updateNotificationPreferences(preferences.chatNotificationsEnabled, preferences.careNotificationsEnabled); setPreferences(result.preferences); setSaved(true); } catch (err) { setError(err instanceof ApiError ? err.message : "Unable to save notification choices."); } finally { setBusy(false); } }}>{busy ? <LoaderCircle className="recorder-spin" aria-hidden="true" /> : <Save aria-hidden="true" />} {busy ? "Saving…" : "Save alerts"}</Button>
      </>}
    </CardContent>
  </Card>;
}
