"use client";

import { useEffect, useState } from "react";
import { api, ApiError, type CareNotification } from "@/lib/api";
import { NotificationsPanel } from "@/components/care/notifications-panel";

export default function PatientNotificationsPage() {
  const [notifications, setNotifications] = useState<CareNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadNotifications = async () => {
    try {
      const res = await api.getMyNotifications();
      setNotifications(res.notifications);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load notifications.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNotifications();
  }, []);

  const handleMarkRead = async (notificationId: string) => {
    try {
      await api.markNotificationRead(notificationId);
      await loadNotifications();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to update notification.");
    }
  };

  if (loading) {
    return <div style={{ display: "flex", justifyContent: "center", padding: "80px" }}><div className="spinner" /></div>;
  }

  return (
    <div className="animate-fade-in" style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      <div>
        <h1 style={{ fontSize: "28px", fontWeight: 700, margin: "0 0 8px 0" }}>Notifications</h1>
        <p style={{ color: "var(--color-text-secondary)", margin: 0 }}>
          Follow up on doctor feedback, reminders, and care updates.
        </p>
      </div>

      {error && (
        <div style={{ padding: "14px 16px", backgroundColor: "#FEF2F2", color: "var(--color-danger)", borderRadius: "var(--radius-md)" }}>
          {error}
        </div>
      )}

      <div className="card" style={{ padding: "24px" }}>
        <NotificationsPanel notifications={notifications} onMarkRead={handleMarkRead} />
      </div>
    </div>
  );
}
