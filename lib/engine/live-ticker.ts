export const LIVE_TICKER_SYMBOLS = ["ETH", "BTC", "UNI", "ARB", "OP"] as const;

export type LiveTickerSymbol = (typeof LIVE_TICKER_SYMBOLS)[number];

const PAIR_TO_SYMBOL: Record<string, LiveTickerSymbol> = {
  ETHUSDT: "ETH",
  BTCUSDT: "BTC",
  UNIUSDT: "UNI",
  ARBUSDT: "ARB",
  OPUSDT: "OP",
};

export const BINANCE_COMBINED_STREAM_URL = `wss://stream.binance.com:9443/stream?streams=${Object.keys(PAIR_TO_SYMBOL)
  .map((pair) => `${pair.toLowerCase()}@aggTrade`)
  .join("/")}`;

export const LIVE_TICKER_DETAIL =
  "Binance last trade in USDT, streamed to this browser. Not a PoolIndex price, not a trading terminal.";

export type LiveTick = { symbol: LiveTickerSymbol; priceUsd: number; eventAt: number };

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function finitePositive(value: unknown): number | undefined {
  const n = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  if (!Number.isFinite(n) || n <= 0) return undefined;
  return n;
}

export function parseBinanceStreamMessage(raw: unknown, now = Date.now()): LiveTick | null {
  const envelope = asRecord(raw);
  if (!envelope) return null;
  const data = asRecord(envelope.data) ?? envelope;
  const pair = typeof data.s === "string" ? data.s.toUpperCase() : "";
  const symbol = PAIR_TO_SYMBOL[pair];
  if (!symbol) return null;
  const priceUsd = finitePositive(data.p);
  if (priceUsd == null) return null;
  const eventAt = finitePositive(data.T) ?? finitePositive(data.E) ?? now;
  return { symbol, priceUsd, eventAt };
}

export function quotesFromLiveBook(book: Partial<Record<LiveTickerSymbol, LiveTick>>): {
  symbol: LiveTickerSymbol;
  priceUsd: number;
}[] {
  const quotes: { symbol: LiveTickerSymbol; priceUsd: number }[] = [];
  for (const symbol of LIVE_TICKER_SYMBOLS) {
    const tick = book[symbol];
    if (!tick || tick.priceUsd <= 0) continue;
    quotes.push({ symbol, priceUsd: tick.priceUsd });
  }
  return quotes;
}
