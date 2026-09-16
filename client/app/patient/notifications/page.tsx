"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Bell, BellRing, CalendarClock, Check, CheckCheck, ChevronRight, CircleAlert, HandHeart, LoaderCircle, MessageCircle, Sparkles } from "lucide-react";
import { api, ApiError, type CareNotification } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
  }).format(new Date(value));
}

function NotificationIcon({ type }: { type: CareNotification["type"] }) {
  if (type === "CHAT_MESSAGE" || type === "DOCTOR_COMMENT") return <MessageCircle />;
  if (type === "REMINDER") return <CalendarClock />;
  if (type === "PATIENT_HELP") return <HandHeart />;
  if (type === "SESSION_RESULT" || type === "SESSION_CHECKIN") return <Sparkles />;
  return <Bell />;
}

export default function PatientNotificationsPage() {
  const [notifications, setNotifications] = useState<CareNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [markingAll, setMarkingAll] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    api.getMyNotifications()
      .then((res) => { if (mounted) setNotifications(res.notifications); })
      .catch((err) => { if (mounted) setError(err instanceof ApiError ? err.message : "Failed to load notifications."); })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, []);

  const orderedNotifications = useMemo(() => [...notifications].sort((left, right) => {
    if (left.isRead !== right.isRead) return left.isRead ? 1 : -1;
    return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
  }), [notifications]);

  const handleMarkRead = async (notificationId: string) => {
    setBusyId(notificationId);
    setError("");
    try {
      await api.markNotificationRead(notificationId);
      setNotifications((current) => current.map((notification) => notification.id === notificationId
        ? { ...notification, isRead: true, readAt: new Date().toISOString() }
        : notification));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to update notification.");
    } finally {
      setBusyId(null);
    }
  };

  const handleMarkAllRead = async () => {
    setMarkingAll(true);
    setError("");
    try {
      await api.markAllNotificationsRead();
      setNotifications((current) =>
        current.map((notification) => ({
          ...notification,
          isRead: true,
          readAt: notification.readAt || new Date().toISOString(),
        }))
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to mark all notifications as read.");
    } finally {
      setMarkingAll(false);
    }
  };

  const unreadCount = notifications.filter((notification) => !notification.isRead).length;

  return (
    <div className="patient-page patient-notifications-page animate-fade-in">
      <header className="patient-page-header">
        <div><span className="patient-page-eyebrow">Care updates</span><h1>Notifications</h1></div>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
          {unreadCount > 0 && <span className="patient-unread-count"><BellRing /> {unreadCount} new</span>}
          {unreadCount > 0 && (
            <Button variant="outline" size="sm" onClick={handleMarkAllRead} disabled={markingAll}>
              {markingAll ? <LoaderCircle className="recorder-spin" /> : <CheckCheck />} Mark all as read
            </Button>
          )}
        </div>
      </header>

      {error && <div className="patient-page-alert" role="alert"><CircleAlert /><span>{error}</span></div>}

      {loading ? (
        <div className="patient-page-loading"><LoaderCircle className="recorder-spin" /><span>Loading your updates…</span></div>
      ) : orderedNotifications.length === 0 ? (
        <Card className="patient-notification-empty"><CardContent><span><Check /></span><strong>You&apos;re all caught up</strong><p>New messages and reminders will appear here.</p></CardContent></Card>
      ) : (
        <Card className="patient-notification-card">
          <CardContent className="patient-notification-list">
            {orderedNotifications.map((notification) => (
              <article className={`patient-notification-row ${notification.isRead ? "" : "patient-notification-unread"}`} key={notification.id}>
                <span className="patient-notification-icon"><NotificationIcon type={notification.type} /></span>
                <div className="patient-notification-copy">
                  <div><strong>{notification.title}</strong>{!notification.isRead && <i>New</i>}</div>
                  <p>{notification.body}</p>
                  <time>{formatDate(notification.createdAt)}</time>
                </div>
                <div className="patient-notification-actions">
                  {!notification.isRead && (
                    <Button variant="ghost" onClick={() => handleMarkRead(notification.id)} disabled={busyId === notification.id}>
                      {busyId === notification.id ? <LoaderCircle className="recorder-spin" /> : <Check />} Mark read
                    </Button>
                  )}
                  {notification.link && <Button variant="outline" nativeButton={false} render={<Link href={notification.link} />}>Open <ChevronRight /></Button>}
                </div>
              </article>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
