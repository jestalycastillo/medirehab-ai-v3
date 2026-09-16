"use client";

import { useEffect, useState } from "react";
import { api, ApiError, type CareNotification } from "@/lib/api";
import { NotificationsPanel } from "@/components/care/notifications-panel";

export default function DoctorNotificationsPage() {
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

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const handleMarkAllRead = async () => {
    try {
      await api.markAllNotificationsRead();
      await loadNotifications();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to mark all as read.");
    }
  };

  if (loading) {
    return <div style={{ display: "flex", justifyContent: "center", padding: "80px" }}><div className="spinner" /></div>;
  }

  return (
    <div className="animate-fade-in" style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "16px" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
            <h1 style={{ fontSize: "28px", fontWeight: 700, margin: 0 }}>Notifications</h1>
            {unreadCount > 0 && (
              <span
                style={{
                  backgroundColor: "var(--color-primary)",
                  color: "#ffffff",
                  fontSize: "12px",
                  fontWeight: 700,
                  padding: "3px 10px",
                  borderRadius: "999px",
                }}
              >
                {unreadCount} Unread
              </span>
            )}
          </div>
        </div>

        {unreadCount > 0 && (
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleMarkAllRead}
            style={{ fontSize: "13px" }}
          >
            Mark all as read
          </button>
        )}
      </div>

      {error && (
        <div style={{ padding: "14px 16px", backgroundColor: "#FEF2F2", color: "var(--color-danger)", borderRadius: "var(--radius-md)" }}>
          {error}
        </div>
      )}

      <div className="card" style={{ padding: "24px" }}>
        <NotificationsPanel
          notifications={notifications}
          onMarkRead={handleMarkRead}
          onMarkAllRead={handleMarkAllRead}
        />
      </div>
    </div>
  );
}
