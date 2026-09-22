"use client";

import {
  BINANCE_COMBINED_STREAM_URL,
  LIVE_TICKER_DETAIL,
  LIVE_TICKER_SYMBOLS,
  parseBinanceStreamMessage,
  type LiveTick,
  type LiveTickerSymbol,
} from "@/lib/engine/live-ticker";
import { formatTickerPriceUsd, type PublicTicker } from "@/lib/engine/markets-format";
import { useEffect, useState } from "react";

const GECKO_POLL_MS = 60_000;
const FLUSH_MS = 250;
const MAX_RECONNECTS = 5;

function utcClock(now: Date): string {
  return `${now.toISOString().slice(11, 19)} UTC`;
}

function quoteAge(staleMs: number | undefined): string {
  if (staleMs == null) return "";
  const sec = Math.max(0, Math.round(staleMs / 1000));
  if (sec <= 1) return "now";
  if (sec < 90) return `${sec}s ago`;
  return `${Math.round(sec / 60)}m ago`;
}

function delayedFromGecko(body: PublicTicker): PublicTicker {
  return {
    ...body,
    source: "coingecko",
    detail: body.detail || "CoinGecko delayed snapshot. Live Binance ticks unavailable.",
  };
}

export function MarketsTicker() {
  const [now, setNow] = useState(() => new Date());
  const [ticker, setTicker] = useState<PublicTicker | null>(null);

  useEffect(() => {
    const clock = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(clock);
  }, []);

  useEffect(() => {
    let cancelled = false;
    let ws: WebSocket | null = null;
    let reconnectTimer: number | undefined;
    let geckoTimer: number | undefined;
    let flushTimer: number | undefined;
    let attempts = 0;
    const pending = new Map<LiveTickerSymbol, LiveTick>();
    const book: Partial<Record<LiveTickerSymbol, LiveTick>> = {};

    function publishLive() {
      const quotes = LIVE_TICKER_SYMBOLS.flatMap((symbol) => {
        const tick = book[symbol];
        if (!tick || tick.priceUsd <= 0) return [];
        return [{ symbol, priceUsd: tick.priceUsd }];
      });
      if (quotes.length === 0) return;
      const latest = Math.max(...quotes.map((q) => book[q.symbol as LiveTickerSymbol]?.eventAt ?? 0));
      setTicker({
        source: "binance",
        available: true,
        fetchedAt: new Date(latest).toISOString(),
        staleMs: Math.max(0, Date.now() - latest),
        quotes,
        detail: LIVE_TICKER_DETAIL,
      });
    }

    function flush() {
      flushTimer = undefined;
      if (cancelled || pending.size === 0) return;
      for (const [symbol, tick] of pending) book[symbol] = tick;
      pending.clear();
      publishLive();
    }

    function scheduleFlush() {
      if (flushTimer != null) return;
      flushTimer = window.setTimeout(flush, FLUSH_MS);
    }

    function stopSocket() {
      if (reconnectTimer != null) {
        window.clearTimeout(reconnectTimer);
        reconnectTimer = undefined;
      }
      if (!ws) return;
      ws.onopen = null;
      ws.onmessage = null;
      ws.onerror = null;
      ws.onclose = null;
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) ws.close();
      ws = null;
    }

    function stopGecko() {
      if (geckoTimer != null) {
        window.clearInterval(geckoTimer);
        geckoTimer = undefined;
      }
    }

    async function loadGecko() {
      if (cancelled || document.visibilityState === "hidden") return;
      try {
        const res = await fetch("/api/markets", { cache: "no-store" });
        if (!res.ok) return;
        const body = (await res.json()) as PublicTicker;
        if (!cancelled && body.available) setTicker(delayedFromGecko(body));
      } catch {
        /* keep last quotes; do not retry in a tight loop */
      }
    }

    function startGeckoFallback() {
      stopSocket();
      void loadGecko();
      if (geckoTimer == null) geckoTimer = window.setInterval(() => void loadGecko(), GECKO_POLL_MS);
    }

    function connect() {
      if (cancelled || document.visibilityState === "hidden") return;
      stopSocket();
      stopGecko();
      const socket = new WebSocket(BINANCE_COMBINED_STREAM_URL);
      ws = socket;
      socket.onopen = () => {
        attempts = 0;
      };
      socket.onmessage = (event) => {
        let raw: unknown;
        try {
          raw = JSON.parse(String(event.data));
        } catch {
          return;
        }
        const tick = parseBinanceStreamMessage(raw);
        if (!tick) return;
        pending.set(tick.symbol, tick);
        scheduleFlush();
      };
      socket.onclose = () => {
        if (cancelled || document.visibilityState === "hidden") return;
        attempts += 1;
        if (attempts > MAX_RECONNECTS) {
          startGeckoFallback();
          return;
        }
        const wait = Math.min(1000 * 2 ** (attempts - 1), 16_000);
        reconnectTimer = window.setTimeout(connect, wait);
      };
    }

    connect();
    const onVisible = () => {
      if (document.visibilityState === "hidden") {
        stopSocket();
        stopGecko();
        return;
      }
      attempts = 0;
      connect();
    };
    document.addEventListener("visibilitychange", onVisible);
    const age = window.setInterval(() => {
      if (cancelled) return;
      setTicker((current) => {
        if (!current?.available || current.source !== "binance" || !current.fetchedAt) return current;
        return { ...current, staleMs: Math.max(0, Date.now() - Date.parse(current.fetchedAt)) };
      });
    }, 1000);

    return () => {
      cancelled = true;
      stopSocket();
      stopGecko();
      if (flushTimer != null) window.clearTimeout(flushTimer);
      window.clearInterval(age);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  const live = ticker?.source === "binance" && ticker.available;

  return (
    <div
      className="border-b border-border/70 bg-muted/30 text-[11px] leading-none"
      title={ticker?.detail ?? LIVE_TICKER_DETAIL}
    >
      <div className="mx-auto flex max-w-6xl items-center gap-3 overflow-x-auto px-4 py-1.5 font-mono text-muted-foreground">
        <span className="shrink-0 text-foreground tabular-nums">{utcClock(now)}</span>
        <span className="shrink-0">crypto 24/7</span>
        {ticker?.available ? (
          <>
            <span className={live ? "shrink-0 text-emerald-400" : "shrink-0"}>{live ? "LIVE" : "delayed"}</span>
            {ticker.quotes.map((quote) => {
              const price = formatTickerPriceUsd(quote.priceUsd);
              if (!price) return null;
              return (
                <span key={quote.symbol} className="shrink-0 text-foreground tabular-nums">
                  {quote.symbol} ${price}
                </span>
              );
            })}
            <span className="shrink-0">{quoteAge(ticker.staleMs)}</span>
            <span className="shrink-0">{live ? "Binance last trade" : "CoinGecko fallback"}</span>
          </>
        ) : (
          <span className="shrink-0">connecting live quotes…</span>
        )}
      </div>
    </div>
  );
}
