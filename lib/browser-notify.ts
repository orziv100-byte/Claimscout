export function walletChangeIsNotifiable(changes?: { kind: string }[]): boolean {
  if (!changes?.length) return false;
  return changes.some((row) => row.kind !== "baseline");
}

export function notifyWalletScanChange(input: { scannedAt?: string; changes?: { kind: string; summary?: string }[] }): void {
  if (typeof Notification === "undefined") return;
  if (Notification.permission !== "granted") return;
  if (!walletChangeIsNotifiable(input.changes)) return;
  const key = `poolindex:notify:${input.scannedAt ?? ""}`;
  try {
    if (input.scannedAt && sessionStorage.getItem(key)) return;
    if (input.scannedAt) sessionStorage.setItem(key, "1");
  } catch {
    /* private mode */
  }
  const summary = input.changes?.find((row) => row.kind !== "baseline")?.summary ?? "Wallet scan changed.";
  new Notification("PoolIndex", { body: summary.slice(0, 140) });
}

export async function requestWalletNotifications(): Promise<NotificationPermission | "unsupported"> {
  if (typeof Notification === "undefined") return "unsupported";
  if (Notification.permission === "granted") return "granted";
  return Notification.requestPermission();
}
