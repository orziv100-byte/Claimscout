export const WALLET_MONITOR_HOUR_UTC = 7;

export function nextWalletMonitorAt(now = new Date(), hourUtc = WALLET_MONITOR_HOUR_UTC): string {
  const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), hourUtc, 0, 0));
  if (next.getTime() <= now.getTime()) next.setUTCDate(next.getUTCDate() + 1);
  return next.toISOString();
}
