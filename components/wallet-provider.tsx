"use client";

import { parsePublicAddress } from "@/lib/address";
import { usePlan } from "@/components/plan-provider";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type WalletMode = "disconnected" | "readonly" | "injected";

type WalletState = {
  address: string | null;
  mode: WalletMode;
  chainId: number | null;
  error: string | null;
  errorUpgradeUrl: string | null;
  connectInjected: () => Promise<void>;
  setReadonlyAddress: (value: string) => Promise<boolean>;
  disconnect: () => void;
  requestClaimTransaction: (tx: {
    to: string;
    data?: string;
    value?: string;
    chainId: number;
  }) => Promise<string>;
};

const WalletContext = createContext<WalletState | null>(null);

const SESSION_KEY = "poolindex.address";

export function WalletProvider({ children }: { children: ReactNode }) {
  const { bindAddress } = usePlan();
  const [address, setAddress] = useState<string | null>(null);
  const [mode, setMode] = useState<WalletMode>("disconnected");
  const [chainId, setChainId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorUpgradeUrl, setErrorUpgradeUrl] = useState<string | null>(null);

  useEffect(() => {
    const saved = sessionStorage.getItem(SESSION_KEY);
    const parsed = saved ? parsePublicAddress(saved) : { ok: false as const, error: "" };
    if (!parsed.ok) return;
    const checksum = parsed.address;
    void bindAddress(checksum).then((bound) => {
      if (!bound.ok && bound.status !== 401) {
        setError(bound.error || "Wallet limit reached.");
        setErrorUpgradeUrl(bound.status === 402 ? bound.upgradeUrl || "/upgrade" : null);
        persist(null);
        return;
      }
      setAddress(checksum);
      setMode("readonly");
    });
  }, [bindAddress]);

  const persist = (next: string | null) => {
    if (next) sessionStorage.setItem(SESSION_KEY, next);
    else sessionStorage.removeItem(SESSION_KEY);
  };

  const connectInjected = useCallback(async () => {
    setError(null);
    setErrorUpgradeUrl(null);
    const eth = window.ethereum;
    if (!eth) {
      setError("No browser wallet found. Paste a public 0x address to scan in read-only mode.");
      return;
    }
    const accounts = (await eth.request({ method: "eth_requestAccounts" })) as string[];
    const account = accounts[0];
    const parsed = account ? parsePublicAddress(account) : { ok: false as const, error: "Wallet did not return a valid address." };
    if (!parsed.ok) {
      setError(parsed.error || "Wallet did not return a valid address.");
      return;
    }
    const checksum = parsed.address;
    const bound = await bindAddress(checksum);
    if (!bound.ok) {
      setError(bound.error || "Wallet limit reached.");
      setErrorUpgradeUrl(bound.status === 402 ? bound.upgradeUrl || "/upgrade" : null);
      return;
    }
    setAddress(checksum);
    setMode("injected");
    persist(checksum);
    try {
      const hexChain = (await eth.request({ method: "eth_chainId" })) as string;
      setChainId(Number.parseInt(hexChain, 16));
    } catch {
      setChainId(null);
    }
  }, [bindAddress]);

  const setReadonlyAddress = useCallback(
    async (value: string) => {
      setError(null);
      setErrorUpgradeUrl(null);
      const trimmed = value.trim();
      if (!trimmed) {
        setAddress(null);
        setMode("disconnected");
        persist(null);
        return false;
      }
      const parsed = parsePublicAddress(trimmed);
      if (!parsed.ok) {
        setError(parsed.error);
        return false;
      }
      const checksum = parsed.address;
      const bound = await bindAddress(checksum);
      if (!bound.ok) {
        if (bound.status === 401) {
          setAddress(checksum);
          setMode("readonly");
          persist(checksum);
          return true;
        }
        setError(bound.error || "Could not store this public address on the account.");
        setErrorUpgradeUrl(bound.status === 402 ? bound.upgradeUrl || "/upgrade" : null);
        return false;
      }
      setAddress(checksum);
      setMode("readonly");
      persist(checksum);
      return true;
    },
    [bindAddress],
  );

  const disconnect = useCallback(() => {
    setAddress(null);
    setMode("disconnected");
    setChainId(null);
    setError(null);
    setErrorUpgradeUrl(null);
    persist(null);
  }, []);

  const requestClaimTransaction = useCallback(
    async (tx: { to: string; data?: string; value?: string; chainId: number }) => {
      if (mode !== "injected" || !address) {
        throw new Error("Connect an injected wallet to submit a claim. Paste-only mode is read-only.");
      }
      const eth = window.ethereum;
      if (!eth) throw new Error("Injected wallet unavailable.");
      const hash = (await eth.request({
        method: "eth_sendTransaction",
        params: [
          {
            from: address,
            to: tx.to,
            data: tx.data ?? "0x",
            value: tx.value ?? "0x0",
          },
        ],
      })) as string;
      return hash;
    },
    [address, mode],
  );

  const value = useMemo(
    () => ({
      address,
      mode,
      chainId,
      error,
      errorUpgradeUrl,
      connectInjected,
      setReadonlyAddress,
      disconnect,
      requestClaimTransaction,
    }),
    [address, mode, chainId, error, errorUpgradeUrl, connectInjected, setReadonlyAddress, disconnect, requestClaimTransaction],
  );

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet(): WalletState {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error("useWallet must be used within WalletProvider");
  return ctx;
}

declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
    };
  }
}
