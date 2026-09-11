export const UA =
  "Claimscout/1.0 (public crypto claim discovery; research tool)";

export async function fetchWithTimeout(
  url: string,
  ms = 12000,
  init: RequestInit = {},
): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, {
      ...init,
      signal: ctrl.signal,
      redirect: init.redirect ?? "follow",
      headers: {
        accept: "text/html,application/json;q=0.9,*/*;q=0.8",
        "user-agent": UA,
        ...(init.headers ?? {}),
      },
    });
  } finally {
    clearTimeout(timer);
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

type CacheEntry<T> = { value: T; expires: number };

const cache = new Map<string, CacheEntry<unknown>>();

export function cached<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit && hit.expires > Date.now()) {
    return Promise.resolve(hit.value as T);
  }
  return fn().then((value) => {
    cache.set(key, { value, expires: Date.now() + ttlMs });
    return value;
  });
}
