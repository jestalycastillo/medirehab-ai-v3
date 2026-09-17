"use client";

import { useAuth, ROLE_DASHBOARDS } from "@/lib/auth-context";
import { api } from "@/lib/api";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { QuickChat } from "@/components/care/quick-chat";

function LayoutDashboardIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="9" rx="1" />
      <rect x="14" y="3" width="7" height="5" rx="1" />
      <rect x="14" y="12" width="7" height="9" rx="1" />
      <rect x="3" y="16" width="7" height="5" rx="1" />
    </svg>
  );
}

function ActivityIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function BellIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 17h5l-1.4-1.4a2 2 0 0 1-.6-1.4V11a6 6 0 1 0-12 0v3.2a2 2 0 0 1-.6 1.4L4 17h5" />
      <path d="M10 17a2 2 0 0 0 4 0" />
    </svg>
  );
}

function LogOutIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}

function MenuIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  );
}

const NAV_ITEMS = [
  { name: "Dashboard", href: "/patient/dashboard", icon: <LayoutDashboardIcon /> },
  { name: "My Exercises", href: "/patient/exercises", icon: <ActivityIcon /> },
  { name: "Notifications", href: "/patient/notifications", icon: <BellIcon /> },
  { name: "Profile", href: "/patient/profile", icon: <SettingsIcon /> },
];

export default function PatientLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const mobileMenuButtonRef = useRef<HTMLButtonElement>(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState("");
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState(0);

  const handleLogout = async () => {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    setLogoutError("");
    try {
      await logout();
    } catch {
      setLogoutError("Unable to sign out. Please check your connection and try again.");
    } finally {
      setIsLoggingOut(false);
    }
  };

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.replace("/login/patient");
      } else if (user.mustChangePassword) {
        router.replace("/change-password");
      } else if (user.role !== "PATIENT") {
        router.replace(ROLE_DASHBOARDS[user.role]);
      }
    }
  }, [user, loading, router]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsMobileMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (loading || user?.role !== "PATIENT" || user.mustChangePassword) return;
    let active = true;
    const loadUnreadCount = () => {
      void api.getMyNotifications()
        .then((res) => {
          if (active) setUnreadNotificationsCount(res.notifications.filter((n) => !n.isRead).length);
        })
        .catch(() => undefined);
    };

    const heartbeat = () => { void api.sendPresenceHeartbeat().catch(() => undefined); };
    heartbeat();
    loadUnreadCount();
    const interval = window.setInterval(() => {
      heartbeat();
      loadUnreadCount();
    }, 15_000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [loading, user, pathname]);

  if (loading || !user || user.role !== "PATIENT" || user.mustChangePassword) {
    return (
      <div className="patient-page-loading" role="status" style={{ minHeight: "100vh" }}>
        <div className="spinner" style={{ width: "32px", height: "32px" }} aria-hidden="true" />Loading patient portal…
      </div>
    );
  }

  return (
    <div className="portal-shell" style={{ display: "flex", backgroundColor: "var(--color-page-bg)" }}>
      <aside className="admin-sidebar">
        <div style={{ padding: "24px", display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={{ color: "var(--color-primary)" }}><ActivityIcon /></div>
          <span style={{ fontSize: "18px", fontWeight: 700, color: "var(--color-text-primary)" }}>
            MediRehab<span style={{ color: "var(--color-primary)" }}> AI</span>
          </span>
        </div>

        <div style={{ padding: "0 16px", marginBottom: "24px" }}>
          <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "8px", paddingLeft: "8px" }}>
            Patient Portal
          </div>
        </div>

        <nav style={{ flex: 1, padding: "0 12px", display: "flex", flexDirection: "column", gap: "4px" }}>
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href || (item.href !== "/patient/dashboard" && pathname.startsWith(item.href));
            const isNotifications = item.href === "/patient/notifications";
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className="admin-nav-item"
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "10px 12px",
                  borderRadius: "var(--radius-md)",
                  color: isActive ? "var(--color-primary-dark)" : "var(--color-text-secondary)",
                  backgroundColor: isActive ? "var(--color-primary-light)" : "transparent",
                  fontWeight: isActive ? 600 : 500,
                  textDecoration: "none",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <div style={{ color: isActive ? "var(--color-primary)" : "var(--color-text-muted)" }}>{item.icon}</div>
                  <span>{item.name}</span>
                </div>
                {isNotifications && unreadNotificationsCount > 0 && (
                  <span
                    style={{
                      backgroundColor: "var(--color-primary)",
                      color: "#ffffff",
                      fontSize: "11px",
                      fontWeight: 700,
                      padding: "2px 7px",
                      borderRadius: "999px",
                      minWidth: "20px",
                      textAlign: "center",
                      lineHeight: "1.3",
                    }}
                  >
                    {unreadNotificationsCount > 99 ? "99+" : unreadNotificationsCount}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <div style={{ padding: "24px 12px", borderTop: "1px solid var(--color-border)" }}>
          <button type="button" onClick={handleLogout} disabled={isLoggingOut} className="admin-nav-item" style={{ display: "flex", alignItems: "center", gap: "12px", padding: "10px 12px", width: "100%", borderRadius: "var(--radius-md)", color: "var(--color-text-secondary)", backgroundColor: "transparent", border: "none", fontWeight: 500, cursor: "pointer", textAlign: "left" }}>
            <div style={{ color: "var(--color-text-muted)" }}><LogOutIcon /></div>
            {isLoggingOut ? "Signing out…" : "Sign out"}
          </button>
        </div>
      </aside>

      <div className="portal-content" style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <header className="admin-mobile-header" style={{ display: "none", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", backgroundColor: "var(--color-surface)", borderBottom: "1px solid var(--color-border)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <div style={{ color: "var(--color-primary)" }}><ActivityIcon /></div>
            <span style={{ fontSize: "16px", fontWeight: 700 }}>Patient Portal</span>
          </div>
          <button ref={mobileMenuButtonRef} type="button" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} aria-label={isMobileMenuOpen ? "Close navigation menu" : "Open navigation menu"} aria-expanded={isMobileMenuOpen} style={{ background: "none", border: "none", color: "var(--color-text-primary)", cursor: "pointer" }}>
            <MenuIcon />
          </button>
        </header>

        {isMobileMenuOpen && (
          <div className="admin-mobile-menu" onKeyDown={(event) => {
            if (event.key === "Escape") {
              setIsMobileMenuOpen(false);
              mobileMenuButtonRef.current?.focus();
            }
          }} style={{ display: "none", backgroundColor: "var(--color-surface)", borderBottom: "1px solid var(--color-border)", padding: "8px 16px 16px" }}>
            <nav style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              {NAV_ITEMS.map((item) => {
                const isActive = pathname === item.href || (item.href !== "/patient/dashboard" && pathname.startsWith(item.href));
                return (
                  <Link key={item.href} href={item.href} aria-current={isActive ? "page" : undefined} style={{ display: "flex", alignItems: "center", gap: "12px", padding: "12px", borderRadius: "var(--radius-md)", color: isActive ? "var(--color-primary-dark)" : "var(--color-text-secondary)", backgroundColor: isActive ? "var(--color-primary-light)" : "transparent", fontWeight: isActive ? 600 : 500, textDecoration: "none" }}>
                    <div style={{ color: isActive ? "var(--color-primary)" : "var(--color-text-muted)" }}>{item.icon}</div>
                    {item.name}
                  </Link>
                );
              })}
              <button type="button" onClick={handleLogout} disabled={isLoggingOut} style={{ display: "flex", alignItems: "center", gap: "12px", padding: "12px", width: "100%", borderRadius: "var(--radius-md)", color: "var(--color-text-secondary)", backgroundColor: "transparent", border: "none", fontWeight: 500, cursor: "pointer", textAlign: "left", marginTop: "8px", borderTop: "1px solid var(--color-border)" }}>
                <div style={{ color: "var(--color-text-muted)" }}><LogOutIcon /></div>
                {isLoggingOut ? "Signing out…" : "Sign out"}
              </button>
            </nav>
          </div>
        )}

        <main style={{ flex: 1, padding: "32px", overflowY: "auto" }} className="admin-main-content">
          {logoutError && <div className="admin-feedback admin-feedback-error" role="alert">{logoutError}</div>}
          {children}
        </main>
      </div>
      <QuickChat role="patient" />
    </div>
  );
}
