import { NextResponse } from "next/server";
import { APP_VERSION } from "@/lib/app-info";
import { createInvite, listInvites, listUsers, updateUser } from "@/lib/auth";
import { readErrors, readSecurity, readTelemetry } from "@/lib/beta-store";
import { listFeedback, publicFeedback, updateFeedbackStatus } from "@/lib/feedback";
import { betaMetrics, readOps, updateOps } from "@/lib/ops";
import { publicSnapshot, readResourceSnapshot } from "@/lib/resource-guard";
import { guardFailed, isResponse, requireAdmin } from "@/lib/request-guard";
import { recordSecurity } from "@/lib/beta-store";

export const runtime = "nodejs";

export async function GET(request: Request, context: { params: Promise<{ action: string }> }) {
  const authed = requireAdmin(request);
  if (isResponse(authed)) return authed;
  const { action } = await context.params;
  const url = new URL(request.url);

  if (action === "summary") {
    const resource = readResourceSnapshot();
    return NextResponse.json({
      version: APP_VERSION,
      metrics: betaMetrics(),
      ops: readOps(),
      resource: publicSnapshot(resource),
      users: listUsers(),
      invites: listInvites(),
    });
  }

  if (action === "users") {
    return NextResponse.json({ users: listUsers(), version: APP_VERSION });
  }

  if (action === "invites") {
    return NextResponse.json({ invites: listInvites(), version: APP_VERSION });
  }

  if (action === "ops") {
    return NextResponse.json({ ops: readOps(), version: APP_VERSION });
  }

  if (action === "feedback") {
    const rows = listFeedback({
      userId: url.searchParams.get("user") || undefined,
      type: url.searchParams.get("type") || undefined,
      source: url.searchParams.get("source") || undefined,
      status: url.searchParams.get("status") || undefined,
      version: url.searchParams.get("version") || undefined,
      after: url.searchParams.get("after") || undefined,
      before: url.searchParams.get("before") || undefined,
    });
    const users = new Map(listUsers().map((user) => [user.id, user.email]));
    return NextResponse.json({
      version: APP_VERSION,
      feedback: rows.map((row) => ({
        ...publicFeedback(row),
        userId: row.userId,
        email: users.get(row.userId) ?? null,
      })),
    });
  }

  if (action === "telemetry") {
    return NextResponse.json({
      version: APP_VERSION,
      telemetry: readTelemetry(400),
      errors: readErrors(100),
      security: readSecurity(100).map((row) => ({
        at: row.at,
        type: row.type,
        userId: row.userId,
        detail: row.detail,
      })),
    });
  }

  return NextResponse.json({ error: "Not found" }, { status: 404 });
}

export async function POST(request: Request, context: { params: Promise<{ action: string }> }) {
  const authed = requireAdmin(request);
  if (isResponse(authed)) return authed;
  const { action } = await context.params;
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

  try {
    if (action === "invites") {
      const invite = createInvite({
        createdBy: authed.user.id,
        email: typeof body.email === "string" ? body.email : undefined,
        stage: body.stage === 2 || body.stage === 3 || body.stage === 1 ? body.stage : undefined,
        maxUses: typeof body.maxUses === "number" ? body.maxUses : 1,
        note: typeof body.note === "string" ? body.note : "",
      });
      return NextResponse.json({ ok: true, invite, version: APP_VERSION });
    }

    if (action === "ops") {
      const ops = updateOps(
        {
          scansEnabled: typeof body.scansEnabled === "boolean" ? body.scansEnabled : undefined,
          maintenanceMode: typeof body.maintenanceMode === "boolean" ? body.maintenanceMode : undefined,
          betaStage: body.betaStage === 1 || body.betaStage === 2 || body.betaStage === 3 ? body.betaStage : undefined,
          reason: typeof body.reason === "string" ? body.reason : undefined,
        },
        authed.user.id,
      );
      return NextResponse.json({ ok: true, ops, version: APP_VERSION });
    }

    if (action === "users") {
      const id = String(body.id || "");
      const user = updateUser(
        id,
        {
          status: typeof body.status === "string" ? (body.status as never) : undefined,
          plan: body.plan === "free" || body.plan === "paid" ? body.plan : undefined,
        },
        authed.user.id,
      );
      recordSecurity({ type: "admin_user_patch", userId: authed.user.id, detail: id });
      return NextResponse.json({ ok: true, user, version: APP_VERSION });
    }

    if (action === "feedback") {
      const row = updateFeedbackStatus(String(body.id || ""), String(body.status || ""), authed.user.id);
      return NextResponse.json({ ok: true, feedback: publicFeedback(row), version: APP_VERSION });
    }
  } catch (err) {
    return guardFailed(err);
  }

  return NextResponse.json({ error: "Not found" }, { status: 404 });
}
