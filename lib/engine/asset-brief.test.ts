import assert from "node:assert/strict";
import { test } from "node:test";
import { applyMarketToContext, walletContextFromScan } from "./asset-brief.ts";
import { parseGoPlusToken } from "./goplus.ts";
import { formatTickerPriceUsd } from "./markets-format.ts";
import { geckoIdForSymbol, parseMarketRow, tickerFromBook } from "./markets.ts";
import type { EngineFinding, EngineScan } from "./types.ts";

test("CoinGecko missing rows stay unavailable instead of fake zero", () => {
  assert.equal(geckoIdForSymbol("UNI"), "uniswap");
  const missing = parseMarketRow("ABC", undefined);
  assert.equal(missing.available, false);
  assert.equal(missing.priceUsd, undefined);
  assert.equal(missing.marketCapUsd, undefined);
  const zeroish = parseMarketRow("UNI", { id: "uniswap", current_price: null, market_cap: null });
  assert.equal(zeroish.available, false);
  assert.equal(zeroish.priceUsd, undefined);
  const live = parseMarketRow("UNI", { id: "uniswap", current_price: 8.2, market_cap: 1_000, total_volume: 50, circulating_supply: 10 });
  assert.equal(live.available, true);
  assert.equal(live.priceUsd, 8.2);
});

test("ticker omits missing prices and is a delayed snapshot, not a live feed", () => {
  const empty = tickerFromBook(null);
  assert.equal(empty.available, false);
  assert.equal(empty.quotes.length, 0);
  const blank = tickerFromBook({ byId: {}, fetchedAt: "2026-09-22T09:00:00.000Z" });
  assert.equal(blank.available, false);
  const ticker = tickerFromBook(
    {
      byId: {
        ethereum: { id: "ethereum", current_price: 3891.4 },
        uniswap: { id: "uniswap", current_price: 0 },
        bitcoin: { id: "bitcoin", current_price: 108_200 },
      },
      fetchedAt: "2026-09-22T09:00:00.000Z",
    },
    Date.parse("2026-09-22T09:00:35.000Z"),
  );
  assert.equal(ticker.available, true);
  assert.deepEqual(
    ticker.quotes.map((q) => q.symbol),
    ["ETH", "BTC"],
  );
  assert.equal(ticker.staleMs, 35_000);
  assert.match(ticker.detail, /not a live exchange feed/i);
  assert.equal(formatTickerPriceUsd(0), "");
  assert.equal(formatTickerPriceUsd(3891.4), "3,891.40");
});

test("GoPlus flags are third-party signals and missing rows invent nothing", () => {
  const empty = parseGoPlusToken(1, "0xabc", {});
  assert.equal(empty.available, false);
  assert.equal(empty.honeypot, undefined);
  const row = parseGoPlusToken(1, "0xabc", {
    result: {
      "0xabc": {
        is_honeypot: "1",
        is_mintable: "0",
        owner_address: "0x0000000000000000000000000000000000000000",
        can_take_back_ownership: "0",
      },
    },
  });
  assert.equal(row.available, true);
  assert.equal(row.honeypot, true);
  assert.equal(row.mintable, false);
  assert.equal(row.ownerRenounced, true);
  assert.match(row.detail, /not a PoolIndex guarantee/i);
});

test("wallet asset context prefers this address and does not invent transfer history", () => {
  const finding: EngineFinding = {
    id: "token-eth-uni:x",
    sourceId: "token-eth-uni",
    category: "forgotten_token",
    chainId: 1,
    chainLabel: "Ethereum",
    verification: "verified",
    title: "UNI",
    detail: "balance",
    amount: "2",
    symbol: "UNI",
    sourceStatus: "ok",
  };
  const scan = {
    address: "0x1111111111111111111111111111111111111111",
    scannedAt: "2026-09-22T00:00:00.000Z",
    profile: { address: "0x1111111111111111111111111111111111111111", chains: [], tokens: [], protocols: [], contracts: [], relevantSourceIds: [] },
    findings: [finding],
    counters: { sourcesChecked: 1, sourcesFailed: 0, chainsChecked: 1, relevantSources: 1, potentialFindings: 1, verifiedFindings: 1 },
    summary: { adaptersChecked: 1, adaptersSucceeded: 1, adaptersFailed: 0, failures: [], verified: 1, uncertain: 0, rejected: 0 },
    changes: [],
  } as unknown as EngineScan;
  const wallet = walletContextFromScan(scan, finding);
  assert.equal(wallet.transferHistory, "not_available");
  assert.match(wallet.detail, /not invented/i);
  const priced = applyMarketToContext(wallet, {
    source: "coingecko",
    available: true,
    symbol: "UNI",
    priceUsd: 10,
    detail: "ok",
  });
  assert.equal(priced.estimatedValueUsd, 20);
});
