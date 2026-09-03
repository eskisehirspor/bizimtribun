"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

export type AuthUser = {
  id: number;
  username: string;
  displayName: string;
  teamId: string | null;
  role: string;
  status: string;
  emailVerified: boolean;
};

type AuthState = {
  user: AuthUser | null;
  banned: boolean;
  message: string | null;
  loading: boolean;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [banned, setBanned] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me", { cache: "no-store" });
      const data = await res.json();
      if (res.status === 403) {
        setUser(null);
        setBanned(true);
        setMessage(data.error || "Hesap askıya alınmış.");
        return;
      }
      setBanned(false);
      setMessage(null);
      const nextUser = data.user
        ? {
            ...data.user,
            emailVerified: Boolean(data.user.emailVerified),
          }
        : null;
      setUser(nextUser);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const logout = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    setBanned(false);
    setMessage(null);
  }, []);

  const value = useMemo(
    () => ({ user, banned, message, loading, refresh, logout }),
    [user, banned, message, loading, refresh, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth");
  return ctx;
}
