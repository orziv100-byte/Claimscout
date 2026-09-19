import { NextResponse } from "next/server";
import { APP_VERSION } from "@/lib/app-info";
import { createInvite, listInvites, listUsers, updateUser } from "@/lib/auth";
import { parseAdminFeedbackPatch, parseAdminInviteInput, parseAdminOpsPatch, parseAdminUserPatch } from "@/lib/admin-input";
import { readErrors, readSecurity, readTelemetry } from "@/lib/beta-store";
import { listFeedback, publicFeedback, updateFeedbackStatus } from "@/lib/feedback";
import { betaMetrics, readOps, updateOps } from "@/lib/ops";
import { publicSnapshot, readResourceSnapshot } from "@/lib/resource-guard";
import { guardFailed, isResponse, requireAdmin } from "@/lib/request-guard";
import { recordSecurity } from "@/lib/beta-store";
import { aggregateFeedbackBySource } from "@/lib/intelligence/feedback-agg";
import { adminStopHunt, huntAdminStats } from "@/lib/intelligence/hunt";
import { DEFAULT_SOURCE_TIERS, sourceTierOverrides } from "@/lib/intelligence/reputation";

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
      hunts: huntAdminStats(),
      sourceReputation: DEFAULT_SOURCE_TIERS,
      sourceOverrides: sourceTierOverrides(),
      sourceFeedback: aggregateFeedbackBySource(),
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

  if (action === "hunts") {
    return NextResponse.json({
      version: APP_VERSION,
      ...huntAdminStats(),
      sourceFeedback: aggregateFeedbackBySource(),
      sourceReputation: DEFAULT_SOURCE_TIERS,
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
      const input = parseAdminInviteInput(body);
      const invite = createInvite({
        createdBy: authed.user.id,
        email: input.email,
        stage: input.stage,
        maxUses: input.maxUses,
        note: input.note,
      });
      return NextResponse.json({ ok: true, invite, version: APP_VERSION });
    }

    if (action === "ops") {
      const ops = updateOps(parseAdminOpsPatch(body), authed.user.id);
      return NextResponse.json({ ok: true, ops, version: APP_VERSION });
    }

    if (action === "users") {
      const patch = parseAdminUserPatch(body);
      const user = updateUser(
        patch.id,
        {
          status: patch.status,
          plan: patch.plan,
          role: patch.role,
        },
        authed.user.id,
      );
      recordSecurity({ type: "admin_user_patch", userId: authed.user.id, detail: patch.id });
      return NextResponse.json({ ok: true, user, version: APP_VERSION });
    }

    if (action === "feedback") {
      const patch = parseAdminFeedbackPatch(body);
      const row = updateFeedbackStatus(patch.id, patch.status, authed.user.id);
      return NextResponse.json({ ok: true, feedback: publicFeedback(row), version: APP_VERSION });
    }

    if (action === "hunts") {
      const huntId = typeof body.huntId === "string" ? body.huntId : "";
      if (!huntId) {
        return NextResponse.json({ error: "Hunt id required.", code: "HUNT_ID_REQUIRED", version: APP_VERSION }, { status: 400 });
      }
      const hunt = await adminStopHunt(huntId);
      recordSecurity({ type: "admin_hunt_stop", userId: authed.user.id, detail: huntId });
      return NextResponse.json({ ok: true, hunt: { id: hunt.id, status: hunt.status, userId: hunt.userId }, version: APP_VERSION });
    }
  } catch (err) {
    return guardFailed(err);
  }

  return NextResponse.json({ error: "Not found" }, { status: 404 });
}
