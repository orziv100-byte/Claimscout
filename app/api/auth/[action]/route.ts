import { NextResponse } from "next/server";
import {
  AuthError,
  loginAccount,
  logoutSession,
  publicUser,
  readSessionUser,
  registerAccount,
  requestPasswordReset,
  resetPassword,
  verifyEmailToken,
} from "@/lib/auth";
import { APP_VERSION } from "@/lib/app-info";
import { readOps } from "@/lib/ops";
import { clearCredentialEmailLimit, clientIp, limitCredentialAttempt, limitTokenAttempt, type CredentialKind } from "@/lib/rate-limit";
import {
  attachSessionCookie,
  clearSessionCookie,
  guardFailed,
  requireSameOrigin,
} from "@/lib/request-guard";

export const runtime = "nodejs";

const ACTIONS = new Set(["register", "login", "logout", "me", "verify", "forgot", "reset"]);

function limitedCredential(kind: CredentialKind, ip: string, email: string) {
  const result = limitCredentialAttempt(kind, ip, email);
  if (result.ok) return null;
  return NextResponse.json(
    { error: "Too many attempts. Wait and try once.", code: "RATE_LIMIT", version: APP_VERSION },
    { status: 429, headers: { "Retry-After": String(result.retryAfterSec) } },
  );
}

function limitedToken(kind: "reset" | "verify", ip: string) {
  const result = limitTokenAttempt(kind, ip);
  if (result.ok) return null;
  return NextResponse.json(
    { error: "Too many attempts. Wait and try once.", code: "RATE_LIMIT", version: APP_VERSION },
    { status: 429, headers: { "Retry-After": String(result.retryAfterSec) } },
  );
}

export async function GET(request: Request, context: { params: Promise<{ action: string }> }) {
  const { action } = await context.params;
  if (!ACTIONS.has(action)) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (action === "me") {
    const session = readSessionUser(request);
    const ops = readOps();
    return NextResponse.json({
      version: APP_VERSION,
      ops: {
        maintenanceMode: ops.maintenanceMode,
        scansEnabled: ops.scansEnabled,
        betaStage: ops.betaStage,
        reason: ops.reason,
      },
      user: session ? publicUser(session.user) : null,
    });
  }

  if (action === "verify") {
    const blocked = limitedToken("verify", clientIp(request));
    if (blocked) return blocked;
    const token = new URL(request.url).searchParams.get("token") || "";
    try {
      const user = verifyEmailToken(token);
      return NextResponse.json({ ok: true, user, version: APP_VERSION });
    } catch (err) {
      return guardFailed(err);
    }
  }

  return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
}

export async function POST(request: Request, context: { params: Promise<{ action: string }> }) {
  const { action } = await context.params;
  if (!ACTIONS.has(action)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const csrf = requireSameOrigin(request);
  if (csrf) return csrf;
  const ip = clientIp(request);
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

  try {
    if (action === "register") {
      const blocked = limitedCredential("register", ip, String(body.email || ""));
      if (blocked) return blocked;
      const created = await registerAccount({
        email: String(body.email || ""),
        password: String(body.password || ""),
        displayName: String(body.displayName || ""),
        inviteCode: String(body.inviteCode || ""),
        acceptTerms: body.acceptTerms === true,
        acceptPrivacy: body.acceptPrivacy === true,
      });
      const payload: Record<string, unknown> = { ok: true, user: created.user, version: APP_VERSION };
      if (process.env.NODE_ENV !== "production") payload.verifyUrl = created.verifyUrl;
      return NextResponse.json(payload);
    }

    if (action === "login") {
      const identifier = String(body.email || body.username || body.login || "");
      const blocked = limitedCredential("login", ip, identifier);
      if (blocked) return blocked;
      const logged = await loginAccount({ email: identifier, password: String(body.password || ""), ip });
      clearCredentialEmailLimit("login", identifier);
      if (logged.user.email) clearCredentialEmailLimit("login", logged.user.email);
      return attachSessionCookie(
        NextResponse.json({
          ok: true,
          user: logged.user,
          mfaRequired: logged.user.role === "admin" && Boolean(logged.user.totpEnabled),
          version: APP_VERSION,
        }),
        logged.cookie,
      );
    }

    if (action === "logout") {
      logoutSession(request);
      return clearSessionCookie(NextResponse.json({ ok: true, version: APP_VERSION }));
    }

    if (action === "verify") {
      const blocked = limitedToken("verify", ip);
      if (blocked) return blocked;
      const user = verifyEmailToken(String(body.token || ""));
      return NextResponse.json({ ok: true, user, version: APP_VERSION });
    }

    if (action === "forgot") {
      const blocked = limitedCredential("forgot", ip, String(body.email || ""));
      if (blocked) return blocked;
      const result = await requestPasswordReset(String(body.email || ""));
      const payload: Record<string, unknown> = { ok: true, sent: true, version: APP_VERSION };
      if (result.resetUrl && process.env.NODE_ENV !== "production") payload.resetUrl = result.resetUrl;
      return NextResponse.json(payload);
    }

    if (action === "reset") {
      const blocked = limitedToken("reset", ip);
      if (blocked) return blocked;
      const reset = await resetPassword(String(body.token || ""), String(body.password || ""));
      return attachSessionCookie(NextResponse.json({ ok: true, user: reset.user, version: APP_VERSION }), reset.cookie);
    }
  } catch (err) {
    if (err instanceof AuthError) return guardFailed(err);
    return guardFailed(err);
  }

  return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
}
