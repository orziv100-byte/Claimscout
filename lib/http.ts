import { readResourceSnapshot, ResourcePressureError } from "./resource-guard";
import { fetchSafe, type FetchImpl, type LookupFn } from "./ssrf";

export const UA = "PoolIndex/1.0 (public crypto claim discovery; research tool)";

const MAX_CACHE_ENTRIES = 48;
const inflight = new Map<string, Promise<unknown>>();

type CacheEntry<T> = { value: T; expires: number };
const cache = new Map<string, CacheEntry<unknown>>();

export type FetchWithTimeoutDeps = {
  lookup?: LookupFn;
  fetchImpl?: FetchImpl;
  maxRedirects?: number;
};

export async function fetchWithTimeout(
  url: string,
  ms = 7000,
  init: RequestInit = {},
  deps: FetchWithTimeoutDeps = {},
): Promise<Response> {
  const pressure = readResourceSnapshot();
  if (pressure.level === "critical") {
    throw new ResourcePressureError(
      `Network fetch blocked: ${pressure.message}`,
      pressure,
    );
  }

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  const parent = init.signal;
  const onParentAbort = () => ctrl.abort();
  if (parent) {
    if (parent.aborted) ctrl.abort();
    else parent.addEventListener("abort", onParentAbort, { once: true });
  }
  try {
    return await fetchSafe(
      url,
      {
        ...init,
        signal: ctrl.signal,
        redirect: init.redirect ?? "follow",
        headers: {
          accept: "text/html,application/json;q=0.9,*/*;q=0.8",
          "user-agent": UA,
          ...(init.headers ?? {}),
        },
      },
      {
        lookup: deps.lookup,
        fetchImpl: deps.fetchImpl,
        maxRedirects: deps.maxRedirects,
      },
    );
  } finally {
    clearTimeout(timer);
    parent?.removeEventListener("abort", onParentAbort);
  }
}

export function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out`)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

export async function readLimitedText(res: Response, maxBytes = 250_000): Promise<string> {
  if (!res.body) return "";
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      const remaining = maxBytes - received;
      if (remaining <= 0) {
        await reader.cancel().catch(() => undefined);
        break;
      }
      if (value.byteLength > remaining) {
        chunks.push(value.slice(0, remaining));
        received += remaining;
        await reader.cancel().catch(() => undefined);
        break;
      }
      chunks.push(value);
      received += value.byteLength;
    }
  } finally {
    reader.releaseLock();
  }
  const merged = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(merged);
}

export async function readJsonLimited<T>(res: Response, maxBytes = 500_000): Promise<T> {
  const text = await readLimitedText(res, maxBytes);
  return JSON.parse(text) as T;
}

function evictCache() {
  const now = Date.now();
  for (const [key, entry] of cache) {
    if (entry.expires <= now) cache.delete(key);
  }
  while (cache.size > MAX_CACHE_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest === undefined) break;
    cache.delete(oldest);
  }
}

export function cached<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit && hit.expires > Date.now()) {
    return Promise.resolve(hit.value as T);
  }
  const pending = inflight.get(key);
  if (pending) return pending as Promise<T>;

  const task = fn()
    .then((value) => {
      cache.set(key, { value, expires: Date.now() + ttlMs });
      evictCache();
      return value;
    })
    .finally(() => {
      inflight.delete(key);
    });

  inflight.set(key, task);
  return task;
}

export function cacheSizeForTests(): number {
  return cache.size;
}

export function clearHttpCacheForTests() {
  cache.clear();
  inflight.clear();
}
