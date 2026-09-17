"use client";

import { useEffect, useState } from "react";
import { api, ApiError, type CareNotification } from "@/lib/api";
import { NotificationsPanel } from "@/components/care/notifications-panel";
import { CircleAlert } from "lucide-react";

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
    let mounted = true;
    void api.getMyNotifications()
      .then((res) => { if (mounted) setNotifications(res.notifications); })
      .catch((err) => { if (mounted) setError(err instanceof ApiError ? err.message : "Failed to load notifications."); })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
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
    return <div className="role-dashboard-loading" role="status"><div className="spinner" aria-hidden="true" />Loading notifications…</div>;
  }

  return (
    <div className="role-dashboard care-page animate-fade-in">
      <header className="role-dashboard-header">
        <div>
          <span className="role-dashboard-eyebrow">Doctor / Notifications</span>
          <h1>Notifications</h1>
          <p>
          Keep track of new patient sessions, check-ins, and reminder items.
          </p>
        </div>
      </header>

      {error && <div className="admin-feedback admin-feedback-error" role="alert"><CircleAlert aria-hidden="true" />{error}</div>}

      <div className="card care-page-panel">
        <NotificationsPanel notifications={notifications} onMarkRead={handleMarkRead} />
      </div>
    </div>
  );
}
