import { guardedJson } from "@/lib/api-guard";
import { publicEntitlement, withEntitlementCookie } from "@/lib/entitlement";
import { capSources } from "@/lib/plan";
import { limitExpensiveEndpoint } from "@/lib/rate-limit";
import { isResponse, rateLimitedResponse, requireScan } from "@/lib/request-guard";
import { runSearch } from "@/lib/search";
import { trackScan, trackSourceFailure } from "@/lib/telemetry";
import { CLAIM_KINDS, CLAIM_STATUSES, SOURCE_KINDS } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function GET(request: Request) {
  const authed = requireScan(request);
  if (isResponse(authed)) return authed;
  const limited = limitExpensiveEndpoint(request, authed.user.id, "search");
  if (!limited.ok) return rateLimitedResponse(limited);

  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q") ?? "";
  const sources = searchParams.get("sources")?.split(",").filter(Boolean);
  const kinds = searchParams.get("kinds")?.split(",").filter(Boolean);
  const statuses = searchParams.get("statuses")?.split(",").filter(Boolean);
  const chain = searchParams.get("chain") ?? undefined;

  const validSources = sources?.filter((s) => s === "catalog" || (SOURCE_KINDS as readonly string[]).includes(s));
  const validKinds = kinds?.filter((k) => (CLAIM_KINDS as readonly string[]).includes(k));
  const validStatuses = statuses?.filter((s) => (CLAIM_STATUSES as readonly string[]).includes(s));
  const ent = { plan: authed.user.plan, wallets: authed.user.wallets };
  const capped = capSources(ent.plan, validSources);
  const plan = publicEntitlement(ent, authed.user.email);
  const startedAt = Date.now();
  trackScan(authed.user, { query, sources: capped.allowed, status: "started" });

  const coalesceKey = `search:${authed.user.id}:${ent.plan}:${query}|${capped.allowed.join(",")}|${(validKinds ?? []).join(",")}|${(validStatuses ?? []).join(",")}|${chain ?? ""}`;

  const res = await guardedJson(
    request,
    "live-scan",
    "heavy",
    async () => {
      try {
        const result = await runSearch(
          {
            query,
            sources: capped.allowed,
            kinds: validKinds,
            statuses: validStatuses,
            chain,
          },
          request.signal,
        );
        for (const failure of result.sourceErrors) {
          trackSourceFailure(failure.source, failure.message, authed.user.id);
        }
        trackScan(authed.user, {
          query,
          sources: capped.allowed,
          status: "completed",
          durationMs: result.tookMs,
          itemCount: result.catalog.length + result.discovered.length,
          blocked: result.blocked,
        });
        return {
          ...result,
          plan: {
            id: plan.plan,
            name: plan.name,
            allowedSources: capped.allowed,
            lockedSources: capped.locked,
            reservedSources: capped.reserved,
            maxWallets: plan.maxWallets,
          },
        };
      } catch (err) {
        trackScan(authed.user, {
          query,
          sources: capped.allowed,
          status: "failed",
          durationMs: Date.now() - startedAt,
          error: err instanceof Error ? err.message : "failed",
        });
        throw err;
      }
    },
    coalesceKey,
  );
  return withEntitlementCookie(res, ent);
}
