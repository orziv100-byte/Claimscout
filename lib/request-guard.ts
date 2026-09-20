import { NextResponse } from "next/server";
import { APP_VERSION } from "./app-info.ts";
import { AuthError, publicUser, readSessionUser } from "./auth.ts";
import type { PublicUser, UserRecord } from "./beta-types.ts";
import { sameOrigin } from "./csrf.ts";
import { inspectEnv } from "./env.ts";
import { scansAreOpen } from "./ops.ts";
import { SESSION_COOKIE, sessionCookieOptions } from "./session-cookie.ts";
import { rateLimitHeaders, type RateLimitResult } from "./rate-limit.ts";

export type Authed = { user: UserRecord; publicUser: PublicUser };

export function requireSameOrigin(request: Request): NextResponse | null {
  if (sameOrigin(request)) return null;
  return NextResponse.json(
    { error: "Cross-origin request blocked.", code: "CSRF", version: APP_VERSION },
    { status: 403 },
  );
}

export function requireUser(
  request: Request,
  opts: { allowUnverified?: boolean } = {},
): Authed | NextResponse {
  const csrf = request.method === "GET" || request.method === "HEAD" ? null : requireSameOrigin(request);
  if (csrf) return csrf;
  const env = inspectEnv();
  if (!env.ok) {
    return NextResponse.json(
      { error: "Server is missing required secrets.", code: "ENV", missing: env.missing, version: APP_VERSION },
      { status: 500 },
    );
  }
  const session = readSessionUser(request);
  if (!session) {
    return NextResponse.json({ error: "Sign in required.", code: "UNAUTHENTICATED", version: APP_VERSION }, { status: 401 });
  }
  if (session.user.status === "disabled" || session.user.status === "suspended" || session.user.deletionStatus === "completed") {
    return NextResponse.json(
      { error: "This account is not allowed to continue.", code: "ACCOUNT_DISABLED", version: APP_VERSION },
      { status: 403 },
    );
  }
  if (!opts.allowUnverified && session.user.status === "pending_verification") {
    return NextResponse.json(
      { error: "Verify your email before using PoolIndex.", code: "EMAIL_UNVERIFIED", version: APP_VERSION },
      { status: 403 },
    );
  }
  return { user: session.user, publicUser: publicUser(session.user) };
}

export function requireAdmin(request: Request): Authed | NextResponse {
  const authed = requireUser(request, { allowUnverified: true });
  if (authed instanceof NextResponse) return authed;
  if (authed.user.role !== "admin") {
    return NextResponse.json({ error: "Admin access required.", code: "FORBIDDEN", version: APP_VERSION }, { status: 403 });
  }
  return authed;
}

export function requireScan(request: Request): Authed | NextResponse {
  const authed = requireUser(request);
  if (authed instanceof NextResponse) return authed;
  if (!scansAreOpen()) {
    return NextResponse.json(
      {
        error: "Scanning is paused. Existing accounts and data are preserved.",
        code: "SCANS_PAUSED",
        version: APP_VERSION,
      },
      { status: 503, headers: { "Retry-After": "30", "Cache-Control": "no-store" } },
    );
  }
  return authed;
}

export function isResponse(value: Authed | NextResponse): value is NextResponse {
  return value instanceof NextResponse;
}

export function rateLimitedResponse(result: Extract<RateLimitResult, { ok: false }>): NextResponse {
  const limited = rateLimitHeaders(result);
  return NextResponse.json(limited.body, { status: limited.status, headers: limited.headers });
}

export function attachSessionCookie(res: NextResponse, cookie: string): NextResponse {
  res.cookies.set(SESSION_COOKIE, cookie, sessionCookieOptions());
  return res;
}

export function clearSessionCookie(res: NextResponse): NextResponse {
  res.cookies.set(SESSION_COOKIE, "", { ...sessionCookieOptions(), maxAge: 0 });
  return res;
}

export function guardFailed(err: unknown): NextResponse {
  if (err instanceof AuthError) {
    return NextResponse.json({ error: err.message, code: err.code, version: APP_VERSION }, { status: err.status });
  }
  if (err && typeof err === "object" && "code" in err && (err as { code: string }).code === "SECRET_MATERIAL_REJECTED") {
    return NextResponse.json(
      { error: (err as Error).message, code: "SECRET_MATERIAL_REJECTED", version: APP_VERSION },
      { status: 400 },
    );
  }
  throw err;
}
