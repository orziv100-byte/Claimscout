import { cached, fetchWithTimeout, readJsonLimited } from "../http.ts";
import type { PublicTicker, TickerQuote } from "./markets-format.ts";

export type { PublicTicker, TickerQuote } from "./markets-format.ts";
export { formatTickerPriceUsd } from "./markets-format.ts";

export const COINGECKO_IDS: Record<string, string> = {
  ETH: "ethereum",
  WETH: "ethereum",
  UNI: "uniswap",
  BTC: "bitcoin",
  WBTC: "wrapped-bitcoin",
  LINK: "chainlink",
  AAVE: "aave",
  LDO: "lido-dao",
  CRV: "curve-dao-token",
  MKR: "maker",
  COMP: "compound-governance-token",
  GRT: "the-graph",
  SNX: "havven",
  "1INCH": "1inch",
  ENS: "ethereum-name-service",
  BAL: "balancer",
  RPL: "rocket-pool",
  RETH: "rocket-pool-eth",
  STETH: "lido-staked-ether",
  ARB: "arbitrum",
  OP: "optimism",
  POL: "matic-network",
  MATIC: "matic-network",
};

export type MarketSnapshot = {
  source: "coingecko";
  available: boolean;
  symbol: string;
  priceUsd?: number;
  marketCapUsd?: number;
  volume24hUsd?: number;
  circulatingSupply?: number;
  detail: string;
};

type MarketsRow = {
  id?: string;
  symbol?: string;
  current_price?: number | null;
  market_cap?: number | null;
  total_volume?: number | null;
  circulating_supply?: number | null;
};

export type MarketBook = {
  byId: Record<string, MarketsRow>;
  fetchedAt: string;
};

export const TICKER_SYMBOLS = ["ETH", "BTC", "UNI", "ARB", "OP"] as const;

export const MARKETS_CACHE_MS = 60_000;

function finitePositive(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  if (value <= 0) return undefined;
  return value;
}

export function geckoIdForSymbol(symbol: string | undefined): string | undefined {
  if (!symbol) return undefined;
  return COINGECKO_IDS[symbol.toUpperCase()];
}

export function parseMarketRow(symbol: string, row: MarketsRow | undefined): MarketSnapshot {
  if (!row) {
    return {
      source: "coingecko",
      available: false,
      symbol,
      detail: "No CoinGecko market row for this symbol. Missing figures are omitted, not shown as zero.",
    };
  }
  const priceUsd = finitePositive(row.current_price ?? undefined);
  const marketCapUsd = finitePositive(row.market_cap ?? undefined);
  const volume24hUsd = finitePositive(row.total_volume ?? undefined);
  const circulatingSupply = finitePositive(row.circulating_supply ?? undefined);
  const available = priceUsd != null;
  return {
    source: "coingecko",
    available,
    symbol,
    priceUsd,
    marketCapUsd,
    volume24hUsd,
    circulatingSupply,
    detail: available
      ? "CoinGecko spot snapshot. Context only — not a trading terminal."
      : "CoinGecko did not return a usable price. Missing figures are omitted, not shown as zero.",
  };
}

const MARKETS_URL = `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${[
  ...new Set(Object.values(COINGECKO_IDS)),
].join(",")}&per_page=40`;

let lastGood: MarketBook | null = null;

export function tickerFromBook(book: MarketBook | null, now = Date.now()): PublicTicker {
  const detail =
    "CoinGecko delayed snapshot. Crypto quotes are 24/7 — this is not a live exchange feed or trading clock.";
  if (!book) {
    return { source: "coingecko", available: false, quotes: [], detail: `${detail} Quotes unavailable.` };
  }
  const quotes: TickerQuote[] = [];
  for (const symbol of TICKER_SYMBOLS) {
    const id = geckoIdForSymbol(symbol);
    const snap = parseMarketRow(symbol, id ? book.byId[id] : undefined);
    if (snap.priceUsd != null) quotes.push({ symbol, priceUsd: snap.priceUsd });
  }
  if (quotes.length === 0) {
    return { source: "coingecko", available: false, quotes: [], detail: `${detail} Quotes unavailable.` };
  }
  const fetched = Date.parse(book.fetchedAt);
  return {
    source: "coingecko",
    available: true,
    fetchedAt: book.fetchedAt,
    staleMs: Number.isFinite(fetched) ? Math.max(0, now - fetched) : undefined,
    quotes,
    detail,
  };
}

export function clearMarketLastGoodForTests() {
  lastGood = null;
}

export async function loadMarketBook(): Promise<MarketBook | null> {
  return cached("engine-coingecko-markets", MARKETS_CACHE_MS, async () => {
    try {
      const res = await fetchWithTimeout(MARKETS_URL, 8_000, { headers: { accept: "application/json" } });
      if (!res.ok) throw new Error(`CoinGecko HTTP ${res.status}`);
      const rows = await readJsonLimited<MarketsRow[]>(res, 80_000);
      const byId: Record<string, MarketsRow> = {};
      if (!Array.isArray(rows)) throw new Error("CoinGecko markets payload was not a list");
      for (const row of rows) {
        if (row?.id) byId[row.id] = row;
      }
      lastGood = { byId, fetchedAt: new Date().toISOString() };
      return lastGood;
    } catch {
      if (lastGood) return lastGood;
      return { byId: {}, fetchedAt: new Date().toISOString() };
    }
  });
}

export async function loadMarketSnapshots(): Promise<Record<string, MarketsRow>> {
  const book = await loadMarketBook();
  return book?.byId ?? {};
}

export async function publicTicker(now = Date.now()): Promise<PublicTicker> {
  const book = await loadMarketBook();
  const empty = !book || Object.keys(book.byId).length === 0;
  return tickerFromBook(empty ? lastGood : book, now);
}

export async function marketSnapshotForSymbol(symbol: string | undefined): Promise<MarketSnapshot> {
  const upper = (symbol || "").toUpperCase();
  if (upper === "USDC" || upper === "USDT" || upper === "DAI") {
    return {
      source: "coingecko",
      available: true,
      symbol: upper,
      priceUsd: 1,
      detail: "Stablecoin treated as $1. Market cap/volume omitted unless CoinGecko returns them.",
    };
  }
  const id = geckoIdForSymbol(upper);
  if (!id) {
    return parseMarketRow(upper || "unknown", undefined);
  }
  const book = await loadMarketSnapshots();
  return parseMarketRow(upper, book[id]);
}
