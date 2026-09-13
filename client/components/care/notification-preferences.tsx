"use client";

import { useEffect, useState } from "react";
import { Bell, LoaderCircle, Save } from "lucide-react";
import { api, type NotificationPreferences as Preferences } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function NotificationPreferences() {
  const [preferences, setPreferences] = useState<Preferences | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => { void api.getNotificationPreferences().then((result) => setPreferences(result.preferences)); }, []);
  if (!preferences) return null;
  return <Card className="patient-preferences-card">
    <CardHeader><div className="patient-settings-heading"><span><Bell /></span><div><CardTitle>Notifications</CardTitle><CardDescription>Choose which updates create an alert.</CardDescription></div></div></CardHeader>
    <CardContent>
      <label className="patient-setting-choice"><input type="checkbox" checked={preferences.chatNotificationsEnabled} onChange={(event) => setPreferences({ ...preferences, chatNotificationsEnabled: event.target.checked })} /><span><strong>Chat messages</strong><small>Alerts for new messages from your care team.</small></span></label>
      <label className="patient-setting-choice"><input type="checkbox" checked={preferences.careNotificationsEnabled} onChange={(event) => setPreferences({ ...preferences, careNotificationsEnabled: event.target.checked })} /><span><strong>Care updates</strong><small>Plans, results, check-ins, and help requests.</small></span></label>
      {saved && <div className="patient-settings-success"><Save /> Notification choices saved.</div>}
      <Button disabled={busy} onClick={async () => { setBusy(true); setSaved(false); try { const result = await api.updateNotificationPreferences(preferences.chatNotificationsEnabled, preferences.careNotificationsEnabled); setPreferences(result.preferences); setSaved(true); } finally { setBusy(false); } }}>{busy ? <LoaderCircle className="recorder-spin" /> : <Save />} Save alerts</Button>
    </CardContent>
  </Card>;
}
