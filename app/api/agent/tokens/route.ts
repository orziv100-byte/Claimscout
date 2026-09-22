import { APP_VERSION } from "@/lib/app-info";
import { isResponse } from "@/lib/request-guard";
import { requireUser } from "@/lib/request-guard";
import { createAgentToken, listAgentTokens, revokeAgentToken } from "@/lib/engine/agent-token";
import { listMcpCalls } from "@/lib/engine/mcp-log";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const authed = requireUser(request);
  if (isResponse(authed)) return authed;
  if (authed.authKind === "agent_token") {
    return NextResponse.json({ error: "Agent tokens cannot manage tokens.", code: "AGENT_TOKEN_NO_ADMIN", version: APP_VERSION }, { status: 403 });
  }
  return NextResponse.json({
    tokens: listAgentTokens(authed.user.id),
    calls: listMcpCalls(authed.user.id),
    version: APP_VERSION,
  });
}

export async function POST(request: Request) {
  const authed = requireUser(request);
  if (isResponse(authed)) return authed;
  if (authed.authKind === "agent_token") {
    return NextResponse.json({ error: "Agent tokens cannot mint tokens.", code: "AGENT_TOKEN_NO_ADMIN", version: APP_VERSION }, { status: 403 });
  }
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const name = typeof body.name === "string" ? body.name : "Connect your agent (read-only)";
  const created = await createAgentToken({ user: authed.user, name });
  return NextResponse.json({
    token: created.token,
    record: created.record,
    warning: "Copy this token now. PoolIndex will not show it again.",
    version: APP_VERSION,
  });
}

export async function DELETE(request: Request) {
  const authed = requireUser(request);
  if (isResponse(authed)) return authed;
  if (authed.authKind === "agent_token") {
    return NextResponse.json({ error: "Agent tokens cannot revoke tokens.", code: "AGENT_TOKEN_NO_ADMIN", version: APP_VERSION }, { status: 403 });
  }
  const url = new URL(request.url);
  const id = url.searchParams.get("id")?.trim() || "";
  const row = await revokeAgentToken(authed.user.id, id);
  if (!row) return NextResponse.json({ error: "Token not found.", version: APP_VERSION }, { status: 404 });
  return NextResponse.json({ ok: true, record: row, version: APP_VERSION });
}
