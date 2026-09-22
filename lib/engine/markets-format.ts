export type TickerQuote = { symbol: string; priceUsd: number };

export type PublicTicker = {
  source: "coingecko" | "binance";
  available: boolean;
  fetchedAt?: string;
  staleMs?: number;
  quotes: TickerQuote[];
  detail: string;
};

export function formatTickerPriceUsd(priceUsd: number): string {
  if (!Number.isFinite(priceUsd) || priceUsd <= 0) return "";
  if (priceUsd >= 1) {
    return priceUsd.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  return priceUsd.toLocaleString("en-US", { minimumFractionDigits: 4, maximumFractionDigits: 4 });
}
