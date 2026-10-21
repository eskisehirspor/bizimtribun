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
  phoneVerified: boolean;
  /** Phone or e-mail verified: may vote and write. */
  verified: boolean;
  /** Team of the account's permanent vote, null until it is cast. */
  voteTeamId: string | null;
};

export type LegalPending = { doc: "terms" | "privacy"; version: string; title: string; path: string; label: string };

type AuthState = {
  user: AuthUser | null;
  /** Current legal texts the signed-in member still has to accept. */
  legalPending: LegalPending[];
  banned: boolean;
  message: string | null;
  loading: boolean;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [legalPending, setLegalPending] = useState<LegalPending[]>([]);
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
            phoneVerified: Boolean(data.user.phoneVerified),
            verified: Boolean(data.user.verified),
            voteTeamId: data.user.voteTeamId ?? null,
          }
        : null;
      setUser(nextUser);
      setLegalPending(nextUser && Array.isArray(data.legalPending) ? data.legalPending : []);
    } catch {
      setUser(null);
      setLegalPending([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(refresh);
  }, [refresh]);

  const logout = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    setLegalPending([]);
    setBanned(false);
    setMessage(null);
  }, []);

  const value = useMemo(
    () => ({ user, legalPending, banned, message, loading, refresh, logout }),
    [user, legalPending, banned, message, loading, refresh, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth");
  return ctx;
}
