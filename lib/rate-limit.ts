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

function parseSingleIp(value: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.includes(",")) return null;
  if (/^(\d{1,3}\.){3}\d{1,3}$/.test(trimmed)) return trimmed;
  if (trimmed.includes(":") && /^[0-9a-fA-F:.]+$/.test(trimmed)) return trimmed;
  return null;
}

/**
 * Rate-limit identity. Cloudflare overwrites CF-Connecting-IP at the edge; clients
 * cannot set it through the tunnel. X-Real-IP, X-Forwarded-For, Forwarded,
 * X-Client-IP, and True-Client-IP are never read — they pass through spoofed.
 * Origin must stay on 127.0.0.1 so a client cannot send CF-Connecting-IP directly.
 * Missing/invalid header → "unknown" (shared bucket), never a fallback spoof header.
 */
export function clientIp(request: Request, env: NodeJS.ProcessEnv = process.env): string {
  if (!trustProxyHeaders(env)) return "unknown";
  return parseSingleIp(request.headers.get("cf-connecting-ip")) || "unknown";
}

export type CredentialKind = "login" | "register" | "forgot";

const CREDENTIAL_LIMITS: Record<CredentialKind, { email: number; ip: number; windowMs: number }> = {
  login: { email: 8, ip: 40, windowMs: 15 * 60 * 1000 },
  register: { email: 10, ip: 30, windowMs: 60 * 60 * 1000 },
  forgot: { email: 3, ip: 5, windowMs: 60 * 60 * 1000 },
};

export function normalizeRateLimitEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Email bucket first, so rotating spoofed IPs cannot reset login/register/forgot. */
export function limitCredentialAttempt(
  kind: CredentialKind,
  ip: string,
  email: string,
  now = Date.now(),
): RateLimitResult {
  const limits = CREDENTIAL_LIMITS[kind];
  const normalized = normalizeRateLimitEmail(email);
  if (normalized) {
    const emailHit = rateLimit(`${kind}:email:${normalized}`, limits.email, limits.windowMs, now);
    if (!emailHit.ok) return emailHit;
  }
  return rateLimit(`${kind}:ip:${ip}`, limits.ip, limits.windowMs, now);
}

export function clearCredentialEmailLimit(kind: CredentialKind, email: string): void {
  const normalized = normalizeRateLimitEmail(email);
  if (normalized) clearRateLimit(`${kind}:email:${normalized}`);
}

const ADMIN_MFA_LIMIT = { limit: 5, windowMs: 5 * 60 * 1000 };

export function limitAdminMfaAttempt(userId: string, now = Date.now()): RateLimitResult {
  return rateLimit(`admin-mfa:${userId}`, ADMIN_MFA_LIMIT.limit, ADMIN_MFA_LIMIT.windowMs, now);
}

/** Token endpoints: never key by the token itself (that would reset the bucket per guess). */
export function limitTokenAttempt(kind: "reset" | "verify", ip: string, now = Date.now()): RateLimitResult {
  return rateLimit(`${kind}:ip:${ip}`, 20, 15 * 60 * 1000, now);
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

export function limitBillingAttempt(userId: string, now = Date.now()): RateLimitResult {
  return rateLimit(`billing:${userId}`, 8, 15 * 60 * 1000, now);
}

export function limitFeedbackAttempt(userId: string, now = Date.now()): RateLimitResult {
  return rateLimit(`feedback:${userId}`, 8, 15 * 60 * 1000, now);
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
