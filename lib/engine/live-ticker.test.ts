import assert from "node:assert/strict";
import { test } from "node:test";
import { parseBinanceStreamMessage, quotesFromLiveBook } from "./live-ticker.ts";

test("Binance aggTrade ticks omit zero, missing, and unknown pairs", () => {
  assert.equal(parseBinanceStreamMessage(null), null);
  assert.equal(parseBinanceStreamMessage({ data: { s: "ETHUSDT", p: "0" } }), null);
  assert.equal(parseBinanceStreamMessage({ data: { s: "ETHUSDT", p: "-1" } }), null);
  assert.equal(parseBinanceStreamMessage({ data: { s: "FAKEUSDT", p: "12" } }), null);
  const tick = parseBinanceStreamMessage({
    stream: "ethusdt@aggTrade",
    data: { e: "aggTrade", E: 1_000, s: "ETHUSDT", p: "2743.23", T: 1_100 },
  });
  assert.equal(tick?.symbol, "ETH");
  assert.equal(tick?.priceUsd, 2743.23);
  assert.equal(tick?.eventAt, 1_100);
  const quotes = quotesFromLiveBook({
    ETH: { symbol: "ETH", priceUsd: 2743.23, eventAt: 1 },
    UNI: { symbol: "UNI", priceUsd: 0, eventAt: 1 },
  });
  assert.deepEqual(
    quotes.map((q) => q.symbol),
    ["ETH"],
  );
});
