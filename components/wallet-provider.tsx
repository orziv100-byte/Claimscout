"use client";

import { isHexAddress } from "@/lib/address";
import { getAddress } from "viem";
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
  connectInjected: () => Promise<void>;
  setReadonlyAddress: (value: string) => void;
  disconnect: () => void;
  requestClaimTransaction: (tx: {
    to: string;
    data?: string;
    value?: string;
    chainId: number;
  }) => Promise<string>;
};

const WalletContext = createContext<WalletState | null>(null);

const SESSION_KEY = "claimscout.address";

export function WalletProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [mode, setMode] = useState<WalletMode>("disconnected");
  const [chainId, setChainId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const saved = sessionStorage.getItem(SESSION_KEY);
    if (saved && isHexAddress(saved)) {
      const checksum = getAddress(saved);
      queueMicrotask(() => {
        setAddress(checksum);
        setMode("readonly");
      });
    }
  }, []);

  const persist = (next: string | null) => {
    if (next) sessionStorage.setItem(SESSION_KEY, next);
    else sessionStorage.removeItem(SESSION_KEY);
  };

  const connectInjected = useCallback(async () => {
    setError(null);
    const eth = window.ethereum;
    if (!eth) {
      setError("No injected wallet found. Paste an address for read-only checks.");
      return;
    }
    const accounts = (await eth.request({ method: "eth_requestAccounts" })) as string[];
    const account = accounts[0];
    if (!account || !isHexAddress(account)) {
      setError("Wallet did not return a valid address.");
      return;
    }
    const checksum = getAddress(account);
    setAddress(checksum);
    setMode("injected");
    persist(checksum);
    try {
      const hexChain = (await eth.request({ method: "eth_chainId" })) as string;
      setChainId(Number.parseInt(hexChain, 16));
    } catch {
      setChainId(null);
    }
  }, []);

  const setReadonlyAddress = useCallback((value: string) => {
    setError(null);
    const trimmed = value.trim();
    if (!trimmed) {
      setAddress(null);
      setMode("disconnected");
      persist(null);
      return;
    }
    if (!isHexAddress(trimmed)) {
      setError("Enter a 0x-prefixed Ethereum address. Seed phrases and private keys are rejected.");
      return;
    }
    const checksum = getAddress(trimmed);
    setAddress(checksum);
    setMode("readonly");
    persist(checksum);
  }, []);

  const disconnect = useCallback(() => {
    setAddress(null);
    setMode("disconnected");
    setChainId(null);
    setError(null);
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
      connectInjected,
      setReadonlyAddress,
      disconnect,
      requestClaimTransaction,
    }),
    [address, mode, chainId, error, connectInjected, setReadonlyAddress, disconnect, requestClaimTransaction],
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
