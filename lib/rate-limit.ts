import { APP_VERSION } from "./app-info.ts";

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

export type RateLimitResult = { ok: true } | { ok: false; retryAfterSec: number };

export type ExpensiveEndpoint = "search" | "verify" | "archive" | "onchain";

const EXPENSIVE_LIMITS: Record<ExpensiveEndpoint, { user: number; ip: number; windowMs: number }> = {
  search: { user: 20, ip: 40, windowMs: 10 * 60 * 1000 },
  verify: { user: 20, ip: 40, windowMs: 10 * 60 * 1000 },
  archive: { user: 30, ip: 60, windowMs: 10 * 60 * 1000 },
  onchain: { user: 20, ip: 40, windowMs: 10 * 60 * 1000 },
};

export function rateLimit(key: string, limit: number, windowMs: number, now = Date.now()): RateLimitResult {
  const current = buckets.get(key);
  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true };
  }
  if (current.count >= limit) {
    return { ok: false, retryAfterSec: Math.max(1, Math.ceil((current.resetAt - now) / 1000)) };
  }
  current.count += 1;
  return { ok: true };
}

export function resetRateLimitForTests() {
  buckets.clear();
}

export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || "unknown";
  return request.headers.get("x-real-ip") || "unknown";
}

export function limitExpensiveEndpoint(
  request: Request,
  userId: string,
  endpoint: ExpensiveEndpoint,
  now = Date.now(),
): RateLimitResult {
  const limits = EXPENSIVE_LIMITS[endpoint];
  const ip = clientIp(request);
  const userHit = rateLimit(`expensive:${endpoint}:user:${userId}`, limits.user, limits.windowMs, now);
  if (!userHit.ok) return userHit;
  return rateLimit(`expensive:${endpoint}:ip:${ip}`, limits.ip, limits.windowMs, now);
}

export function rateLimitHeaders(result: Extract<RateLimitResult, { ok: false }>): {
  status: 429;
  body: { error: string; code: "RATE_LIMIT"; version: string };
  headers: { "Retry-After": string; "Cache-Control": string };
} {
  return {
    status: 429,
    body: {
      error: "Too many requests. Wait, then try once — do not retry in a loop.",
      code: "RATE_LIMIT",
      version: APP_VERSION,
    },
    headers: { "Retry-After": String(result.retryAfterSec), "Cache-Control": "no-store" },
  };
}
