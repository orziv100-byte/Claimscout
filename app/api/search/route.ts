import { guardedJson } from "@/lib/api-guard";
import { entitlementFromRequest, publicEntitlement, withEntitlementCookie } from "@/lib/entitlement";
import { capSources } from "@/lib/plan";
import { runSearch } from "@/lib/search";
import { CLAIM_KINDS, CLAIM_STATUSES, SOURCE_KINDS } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q") ?? "";
  const sources = searchParams.get("sources")?.split(",").filter(Boolean);
  const kinds = searchParams.get("kinds")?.split(",").filter(Boolean);
  const statuses = searchParams.get("statuses")?.split(",").filter(Boolean);
  const chain = searchParams.get("chain") ?? undefined;

  const validSources = sources?.filter((s) => s === "catalog" || (SOURCE_KINDS as readonly string[]).includes(s));
  const validKinds = kinds?.filter((k) => (CLAIM_KINDS as readonly string[]).includes(k));
  const validStatuses = statuses?.filter((s) => (CLAIM_STATUSES as readonly string[]).includes(s));
  const ent = entitlementFromRequest(request);
  const capped = capSources(ent.plan, validSources);
  const plan = publicEntitlement(ent);

  const coalesceKey = `search:${ent.plan}:${query}|${capped.allowed.join(",")}|${(validKinds ?? []).join(",")}|${(validStatuses ?? []).join(",")}|${chain ?? ""}`;

  const res = await guardedJson(
    request,
    "live-scan",
    "heavy",
    async () => {
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
    },
    coalesceKey,
  );
  return withEntitlementCookie(res, ent);
}
