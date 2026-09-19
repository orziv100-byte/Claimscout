import { NextResponse } from "next/server";
import { APP_VERSION } from "@/lib/app-info";
import { guardedJson } from "@/lib/api-guard";
import { SOURCE_KINDS, CLAIM_KINDS } from "@/lib/types";
import {
  listUserHunts,
  loadHuntForUser,
  pauseHunt,
  publicHunt,
  resumeHunt,
  returnDigest,
  startHunt,
  stopHunt,
  tickHunt,
  type HuntSeed,
} from "@/lib/intelligence/hunt";
import { AuthError } from "@/lib/auth";
import { limitExpensiveEndpoint } from "@/lib/rate-limit";
import { guardFailed, isResponse, rateLimitedResponse, requireScan, requireUser } from "@/lib/request-guard";

export const runtime = "nodejs";
export const maxDuration = 30;

function parseSeed(raw: unknown): HuntSeed | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const seed = raw as { catalogIds?: unknown; discovered?: unknown };
  const catalogIds = Array.isArray(seed.catalogIds)
    ? seed.catalogIds.filter((id): id is string => typeof id === "string").slice(0, 40)
    : [];
  const discovered = Array.isArray(seed.discovered)
    ? seed.discovered
        .filter((row) => row && typeof row === "object")
        .slice(0, 40)
        .map((row) => {
          const item = row as Record<string, unknown>;
          const source = String(item.source || "");
          const kind = String(item.kind || "unknown");
          return {
            id: String(item.id || "").slice(0, 80),
            title: String(item.title || "").slice(0, 200),
            summary: String(item.summary || "").slice(0, 500),
            url: String(item.url || "").slice(0, 500),
            kind: ((CLAIM_KINDS as readonly string[]).includes(kind) ? kind : "unknown") as HuntSeed["discovered"][number]["kind"],
            source: ((SOURCE_KINDS as readonly string[]).includes(source) ? source : "blog") as HuntSeed["discovered"][number]["source"],
            sourceLabel: String(item.sourceLabel || source || "source").slice(0, 80),
            publishedAt: typeof item.publishedAt === "string" ? item.publishedAt : undefined,
            legitimacy: typeof item.legitimacy === "string" ? item.legitimacy : undefined,
            flags: Array.isArray(item.flags) ? item.flags.filter((flag): flag is string => typeof flag === "string") : undefined,
            archiveUrl: typeof item.archiveUrl === "string" ? item.archiveUrl : undefined,
            catalogId: typeof item.catalogId === "string" ? item.catalogId : undefined,
          };
        })
    : [];
  return { catalogIds, discovered };
}

export async function GET(request: Request) {
  const authed = requireUser(request);
  if (isResponse(authed)) return authed;
  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  try {
    if (id) {
      const hunt = loadHuntForUser(authed.user.id, id);
      return NextResponse.json({
        version: APP_VERSION,
        hunt: publicHunt(hunt),
        digest: returnDigest(authed.user.id, hunt),
      });
    }
    return NextResponse.json({
      version: APP_VERSION,
      hunts: listUserHunts(authed.user.id),
    });
  } catch (err) {
    return guardFailed(err);
  }
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const action = String(body.action || "tick");
  const huntId = typeof body.huntId === "string" ? body.huntId : "";

  try {
    if (action === "start") {
      const authed = requireScan(request);
      if (isResponse(authed)) return authed;
      const limited = limitExpensiveEndpoint(request, authed.user.id, "hunt");
      if (!limited.ok) return rateLimitedResponse(limited);
      return await guardedJson(request, "deep-hunt-start", "heavy", async () => {
        const hunt = await startHunt({
          userId: authed.user.id,
          plan: authed.user.plan,
          query: String(body.query || ""),
          wallet: typeof body.wallet === "string" ? body.wallet : undefined,
          wallets: authed.user.wallets,
          mode: body.mode === "continuous" ? "continuous" : "deep",
          seed: parseSeed(body.seed),
        });
        return { version: APP_VERSION, hunt: publicHunt(hunt), digest: returnDigest(authed.user.id, hunt) };
      });
    }

    const authed = action === "resume" || action === "tick" ? requireScan(request) : requireUser(request);
    if (isResponse(authed)) return authed;
    if (!huntId) {
      throw new AuthError(400, "HUNT_ID_REQUIRED", "Hunt id required.");
    }
    const limited = limitExpensiveEndpoint(request, authed.user.id, "hunt");
    if (!limited.ok) return rateLimitedResponse(limited);

    if (action === "pause") {
      const hunt = await pauseHunt(authed.user.id, huntId);
      return NextResponse.json({ version: APP_VERSION, hunt: publicHunt(hunt) });
    }
    if (action === "stop") {
      const hunt = await stopHunt(authed.user.id, huntId);
      return NextResponse.json({ version: APP_VERSION, hunt: publicHunt(hunt) });
    }
    if (action === "resume") {
      return await guardedJson(request, "deep-hunt-resume", "light", async () => {
        const hunt = await resumeHunt(authed.user.id, huntId);
        return { version: APP_VERSION, hunt: publicHunt(hunt) };
      });
    }
    if (action === "tick") {
      return await guardedJson(request, "deep-hunt-tick", "heavy", async () => {
        const hunt = await tickHunt(authed.user.id, huntId);
        return { version: APP_VERSION, hunt: publicHunt(hunt), digest: returnDigest(authed.user.id, hunt) };
      });
    }
    throw new AuthError(400, "INVALID_ACTION", "Unknown hunt action.");
  } catch (err) {
    return guardFailed(err);
  }
}
