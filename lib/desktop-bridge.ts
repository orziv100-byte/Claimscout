export type DesktopWalletJob = {
  status?: "running" | "done" | "failed" | "idle";
  progress?: unknown;
  error?: string;
  eligibility?: unknown;
  engine?: unknown;
};

type DesktopBridge = {
  shell?: string;
  scanWallet?: (address: string) => Promise<DesktopWalletJob>;
  pollWallet?: (address: string) => Promise<DesktopWalletJob>;
};

declare global {
  interface Window {
    poolindexDesktop?: DesktopBridge;
  }
}

export function desktopWalletBridge(): {
  scanWallet: (address: string) => Promise<DesktopWalletJob>;
  pollWallet: (address: string) => Promise<DesktopWalletJob>;
} | null {
  if (typeof window === "undefined") return null;
  const bridge = window.poolindexDesktop;
  if (bridge?.shell !== "poolindex-desktop") return null;
  if (typeof bridge.scanWallet !== "function" || typeof bridge.pollWallet !== "function") return null;
  return { scanWallet: bridge.scanWallet, pollWallet: bridge.pollWallet };
}
