"use client";

import Link from "next/link";
import { type CareNotification } from "@/lib/api";

function formatDate(value?: string) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

export function NotificationsPanel({
  notifications,
  onMarkRead,
}: {
  notifications: CareNotification[];
  onMarkRead?: (notificationId: string) => Promise<void> | void;
}) {
  if (notifications.length === 0) {
    return (
      <div className="care-page-empty" role="status">
        <strong>No notifications yet</strong>
        <p>Messages and care updates will appear here.</p>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      {notifications.map((notification) => (
        <article
          key={notification.id}
          style={{
            border: "1px solid var(--color-border)",
            borderRadius: "var(--radius-md)",
            padding: "16px",
            backgroundColor: notification.isRead ? "var(--color-surface)" : "var(--color-primary-soft)",
            display: "flex",
            flexDirection: "column",
            gap: "10px",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "flex-start", flexWrap: "wrap" }}>
            <div>
              <div style={{ fontWeight: 700, marginBottom: "4px" }}>{notification.title}</div>
              <div style={{ color: "var(--color-text-secondary)", fontSize: "14px" }}>{notification.body}</div>
            </div>
            {!notification.isRead && <span className="badge badge-blue">New</span>}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
            <div style={{ color: "var(--color-text-muted)", fontSize: "12px" }}>{formatDate(notification.createdAt)}</div>
            <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
              {notification.link && (
                <Link className="btn btn-secondary" href={notification.link}>
                  Open
                </Link>
              )}
              {!notification.isRead && onMarkRead && (
                <button
                  className="btn btn-primary"
                  onClick={() => onMarkRead(notification.id)}
                >
                  Mark Read
                </button>
              )}
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}
