import { NextResponse } from "next/server";
import { APP_VERSION } from "./app-info.ts";
import { AuthError, publicUser, readSessionUser } from "./auth.ts";
import type { PublicUser, UserRecord } from "./beta-types.ts";
import { sameOrigin } from "./csrf.ts";
import { inspectEnv } from "./env.ts";
import { scansAreOpen } from "./ops.ts";
import { ADMIN_MFA_COOKIE, adminMfaSatisfied } from "./admin-mfa.ts";
import { SESSION_COOKIE, sessionCookieOptions } from "./session-cookie.ts";
import { rateLimitHeaders, type RateLimitResult } from "./rate-limit.ts";
import { readAgentToken, scopesFromToken, type McpScope } from "./engine/agent-token.ts";

export type Authed = {
  user: UserRecord;
  publicUser: PublicUser;
  authKind?: "session" | "agent_token";
  scopes?: readonly McpScope[];
  tokenId?: string;
  sessionId?: string;
};

export function requireSameOrigin(request: Request): NextResponse | null {
  if (sameOrigin(request)) return null;
  return NextResponse.json(
    { error: "Cross-origin request blocked.", code: "CSRF", version: APP_VERSION },
    { status: 403 },
  );
}

export function requireUser(
  request: Request,
  opts: { allowUnverified?: boolean; agentTokenOnly?: boolean } = {},
): Authed | NextResponse {
  const csrfNeeded =
    !opts.agentTokenOnly &&
    request.method !== "GET" &&
    request.method !== "HEAD" &&
    !/^Bearer\s+\S+/i.test(request.headers.get("authorization") ?? "");
  const csrf = csrfNeeded ? requireSameOrigin(request) : null;
  if (csrf) return csrf;
  const env = inspectEnv();
  if (!env.ok) {
    return NextResponse.json(
      { error: "Server is missing required secrets.", code: "ENV", version: APP_VERSION },
      { status: 500 },
    );
  }
  const session = opts.agentTokenOnly ? null : readSessionUser(request);
  const agent = session ? null : readAgentToken(request);
  if (!session && !agent) {
    const error = opts.agentTokenOnly
      ? "Connect your agent with a read-only MCP token (Authorization: Bearer piagt_…). Create it on Account."
      : "Sign in required.";
    return NextResponse.json({ error, code: "UNAUTHENTICATED", version: APP_VERSION }, { status: 401 });
  }
  const user = session?.user ?? agent!.user;
  const authKind = session ? "session" : "agent_token";
  const scopes = agent ? scopesFromToken(agent.token) : undefined;
  const tokenId = agent?.token.id;
  if (user.status === "disabled" || user.status === "suspended" || user.deletionStatus === "completed") {
    return NextResponse.json(
      { error: "This account is not allowed to continue.", code: "ACCOUNT_DISABLED", version: APP_VERSION },
      { status: 403 },
    );
  }
  if (!opts.allowUnverified && user.status === "pending_verification") {
    return NextResponse.json(
      { error: "Verify your email before using PoolIndex.", code: "EMAIL_UNVERIFIED", version: APP_VERSION },
      { status: 403 },
    );
  }
  return { user, publicUser: publicUser(user), authKind, scopes, tokenId, sessionId: session?.session.id };
}

/** MCP tools/call: Bearer agent token only. Cookie CSRF does not apply. */
export function requireAgentToken(request: Request, opts: { allowUnverified?: boolean } = {}): Authed | NextResponse {
  return requireUser(request, { ...opts, agentTokenOnly: true });
}

export function requireAdmin(request: Request, opts: { allowMissingMfa?: boolean } = {}): Authed | NextResponse {
  const authed = requireUser(request, { allowUnverified: true });
  if (authed instanceof NextResponse) return authed;
  if (authed.authKind === "agent_token") {
    return NextResponse.json(
      { error: "Agent tokens cannot use admin write routes.", code: "AGENT_TOKEN_NO_ADMIN", version: APP_VERSION },
      { status: 403 },
    );
  }
  if (authed.user.role !== "admin") {
    return NextResponse.json({ error: "Admin access required.", code: "FORBIDDEN", version: APP_VERSION }, { status: 403 });
  }
  if (authed.user.totpEnabled && !opts.allowMissingMfa && !adminMfaSatisfied(request, authed.user.id, authed.sessionId)) {
    return NextResponse.json(
      { error: "Admin authenticator code required.", code: "MFA_REQUIRED", version: APP_VERSION },
      { status: 401 },
    );
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

export function attachAdminMfaCookie(res: NextResponse, cookie: string): NextResponse {
  res.cookies.set(ADMIN_MFA_COOKIE, cookie, sessionCookieOptions());
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
    const message =
      "message" in err && typeof (err as { message: unknown }).message === "string"
        ? (err as { message: string }).message
        : "Rejected";
    return NextResponse.json(
      { error: message, code: "SECRET_MATERIAL_REJECTED", version: APP_VERSION },
      { status: 400 },
    );
  }
  throw err;
}
