"use client";

import { PortalPage, PortalPageHeader } from "@/components/ui/portal-page";
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
    return <div className="role-dashboard-loading" role="status"><div className="spinner" aria-hidden="true" />Loading notifications…</div>;
  }

  return (
    <PortalPage>
      <PortalPageHeader title="Notifications" eyebrow="Doctor / Care updates" description={`${unreadCount} unread · Patient sessions, check-ins, and reminders.`} actions={unreadCount > 0 ? <button type="button" className="btn btn-secondary" onClick={handleMarkAllRead}>Mark all as read</button> : undefined} />

      {error && <div className="admin-feedback admin-feedback-error" role="alert"><CircleAlert aria-hidden="true" />{error}</div>}

      <div className="card care-page-panel">
        <NotificationsPanel
          notifications={notifications}
          onMarkRead={handleMarkRead}
        />
      </div>
    </PortalPage>
  );
}
