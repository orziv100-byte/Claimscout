"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { PublicUser } from "@/lib/beta-types";

type OpsPublic = {
  maintenanceMode: boolean;
  scansEnabled: boolean;
  betaStage: 1 | 2 | 3;
  reason: string;
};

type AuthState = {
  user: PublicUser | null;
  ops: OpsPublic | null;
  loading: boolean;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [ops, setOps] = useState<OpsPublic | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me");
      const json = (await res.json().catch(() => ({}))) as { user?: PublicUser | null; ops?: OpsPublic };
      setUser(json.user ?? null);
      setOps(json.ops ?? null);
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
    await fetch("/api/auth/logout", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
    setUser(null);
    await refresh();
  }, [refresh]);

  const value = useMemo(
    () => ({ user, ops, loading, refresh, logout }),
    [user, ops, loading, refresh, logout],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
