import { APP_VERSION } from "./app-info.ts";
import { isUnlimitedWalletAccount } from "./plan.ts";

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

export type RateLimitResult = { ok: true } | { ok: false; retryAfterSec: number };

export type ExpensiveEndpoint = "search" | "verify" | "archive" | "onchain" | "hunt" | "agent";

const EXPENSIVE_LIMITS: Record<ExpensiveEndpoint, { user: number; ip: number; windowMs: number }> = {
  search: { user: 20, ip: 40, windowMs: 10 * 60 * 1000 },
  verify: { user: 20, ip: 40, windowMs: 10 * 60 * 1000 },
  archive: { user: 30, ip: 60, windowMs: 10 * 60 * 1000 },
  onchain: { user: 20, ip: 40, windowMs: 10 * 60 * 1000 },
  hunt: { user: 40, ip: 80, windowMs: 10 * 60 * 1000 },
  agent: { user: 8, ip: 16, windowMs: 10 * 60 * 1000 },
};

const POLL_LIMITS = { user: 700, ip: 1400, windowMs: 10 * 60 * 1000 };
const OPERATOR_ONCHAIN_LIMITS = { user: 120, ip: 240, windowMs: 10 * 60 * 1000 };

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

export function clearRateLimit(key: string): void {
  buckets.delete(key);
}

export function resetRateLimitForTests() {
  buckets.clear();
}

/** Only trust forwarding headers when the process sits behind a proxy we control. */
export function trustProxyHeaders(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.POOLINDEX_TRUST_PROXY === "1";
}

export function clientIp(request: Request, env: NodeJS.ProcessEnv = process.env): string {
  if (!trustProxyHeaders(env)) return "unknown";
  const real = request.headers.get("x-real-ip")?.trim();
  if (real) return real;
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || "unknown";
  return "unknown";
}

export function limitExpensiveEndpoint(
  request: Request,
  userId: string,
  endpoint: ExpensiveEndpoint,
  nowOrOpts: number | { now?: number; email?: string | null } = Date.now(),
): RateLimitResult {
  const now = typeof nowOrOpts === "number" ? nowOrOpts : (nowOrOpts.now ?? Date.now());
  const email = typeof nowOrOpts === "number" ? undefined : nowOrOpts.email;
  const limits =
    endpoint === "onchain" && isUnlimitedWalletAccount(email) ? OPERATOR_ONCHAIN_LIMITS : EXPENSIVE_LIMITS[endpoint];
  const ip = clientIp(request);
  const userHit = rateLimit(`expensive:${endpoint}:user:${userId}`, limits.user, limits.windowMs, now);
  if (!userHit.ok) return userHit;
  return rateLimit(`expensive:${endpoint}:ip:${ip}`, limits.ip, limits.windowMs, now);
}

export function limitOnchainPoll(
  request: Request,
  userId: string,
  now = Date.now(),
): RateLimitResult {
  const ip = clientIp(request);
  const userHit = rateLimit(`expensive:onchain-poll:user:${userId}`, POLL_LIMITS.user, POLL_LIMITS.windowMs, now);
  if (!userHit.ok) return userHit;
  return rateLimit(`expensive:onchain-poll:ip:${ip}`, POLL_LIMITS.ip, POLL_LIMITS.windowMs, now);
}

export function limitPublicTicker(request: Request, now = Date.now()): RateLimitResult {
  return rateLimit(`public:ticker:ip:${clientIp(request)}`, 30, 60_000, now);
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
