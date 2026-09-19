"use client";

import { PLANS, sourceAccess, type PlanId, type ScanSource } from "@/lib/plan";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type PlanState = {
  plan: PlanId;
  name: string;
  maxWallets: number;
  wallets: string[];
  sources: readonly string[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  activateLicense: (license: string) => Promise<boolean>;
  bindAddress: (address: string) => Promise<{ ok: boolean; error?: string }>;
  sourceAccessFor: (source: string) => ReturnType<typeof sourceAccess>;
};

const PlanContext = createContext<PlanState | null>(null);

type PlanPayload = {
  plan?: PlanId;
  name?: string;
  maxWallets?: number;
  wallets?: string[];
  sources?: string[];
  error?: string;
};

export function PlanProvider({ children }: { children: ReactNode }) {
  const [plan, setPlan] = useState<PlanId>("free");
  const [name, setName] = useState(PLANS.free.name);
  const [maxWallets, setMaxWallets] = useState(PLANS.free.maxWallets);
  const [wallets, setWallets] = useState<string[]>([]);
  const [sources, setSources] = useState<readonly string[]>(PLANS.free.sources);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const apply = (json: PlanPayload) => {
    if (json.plan === "free" || json.plan === "paid") setPlan(json.plan);
    if (json.name) setName(json.name);
    if (typeof json.maxWallets === "number") setMaxWallets(json.maxWallets);
    if (Array.isArray(json.wallets)) setWallets(json.wallets);
    if (Array.isArray(json.sources)) setSources(json.sources);
  };

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("/api/plan");
        const json = (await res.json().catch(() => ({}))) as PlanPayload;
      if (res.status === 401) {
        apply({ plan: "free", name: PLANS.free.name, maxWallets: PLANS.free.maxWallets, wallets: [], sources: [...PLANS.free.sources] });
        return;
      }
      if (!res.ok) throw new Error(json.error || "Could not load plan");
      apply(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load plan");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const activateLicense = useCallback(async (license: string) => {
    setError(null);
    const res = await fetch("/api/plan", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ license }),
    });
    const json = (await res.json().catch(() => ({}))) as PlanPayload;
    if (!res.ok) {
      setError(json.error || "That Scout+ key is not valid.");
      return false;
    }
    apply(json);
    return true;
  }, []);

  const bindAddress = useCallback(async (address: string) => {
    const res = await fetch("/api/plan", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ address }),
    });
    const json = (await res.json().catch(() => ({}))) as PlanPayload;
    if (res.status === 402) {
      apply(json);
      return { ok: false, error: json.error || "Wallet limit reached. Upgrade to Scout+." };
    }
    if (!res.ok) return { ok: false, error: json.error || "Could not bind wallet" };
    apply(json);
    return { ok: true };
  }, []);

  const value = useMemo<PlanState>(
    () => ({
      plan,
      name,
      maxWallets,
      wallets,
      sources,
      loading,
      error,
      refresh,
      activateLicense,
      bindAddress,
      sourceAccessFor: (source: string) => sourceAccess(plan, source as ScanSource),
    }),
    [plan, name, maxWallets, wallets, sources, loading, error, refresh, activateLicense, bindAddress],
  );

  return <PlanContext.Provider value={value}>{children}</PlanContext.Provider>;
}

export function usePlan(): PlanState {
  const ctx = useContext(PlanContext);
  if (!ctx) throw new Error("usePlan must be used within PlanProvider");
  return ctx;
}
