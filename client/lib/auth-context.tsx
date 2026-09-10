"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import { useRouter, usePathname } from "next/navigation";
import { api, type ApiUser } from "@/lib/api";

type UserRole = "ADMIN" | "DOCTOR" | "PATIENT";

interface AuthContextValue {
  user: ApiUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ mustChangePassword: boolean; user: ApiUser }>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/** Role → default dashboard path */
const ROLE_DASHBOARDS: Record<UserRole, string> = {
  ADMIN: "/admin/dashboard",
  DOCTOR: "/doctor/dashboard",
  PATIENT: "/patient/dashboard",
};

/** Public paths that don't require auth */
const PUBLIC_PATHS = ["/", "/get-started", "/login/doctor", "/login/patient", "/login/admin"];

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<ApiUser | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  // Restore session on mount
  useEffect(() => {
    let cancelled = false;
    api
      .me()
      .then((res) => {
        if (!cancelled) setUser(res.user);
      })
      .catch(() => {
        if (!cancelled) setUser(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Redirect unauthenticated users away from protected routes
  useEffect(() => {
    if (loading) return;
    const isPublic = PUBLIC_PATHS.some(
      (p) => pathname === p || pathname === p + "/"
    );
    if (!user && !isPublic && pathname !== "/change-password") {
      if (pathname.startsWith("/doctor")) {
        router.replace("/login/doctor");
      } else if (pathname.startsWith("/admin")) {
        router.replace("/login/admin");
      } else if (pathname.startsWith("/patient")) {
        router.replace("/login/patient");
      } else {
        router.replace("/");
      }
    }
  }, [user, loading, pathname, router]);

  const login = useCallback(
    async (email: string, password: string) => {
      const res = await api.login(email, password);
      setUser(res.user);
      return { mustChangePassword: res.mustChangePassword, user: res.user };
    },
    []
  );

  const logout = useCallback(async () => {
    await api.logout();
    setUser(null);
    window.location.replace("/");
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const res = await api.me();
      setUser(res.user);
    } catch {
      setUser(null);
    }
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}

export { ROLE_DASHBOARDS, PUBLIC_PATHS };
export type { UserRole };
