import { runSearch } from "@/lib/search";
import { CLAIM_KINDS, CLAIM_STATUSES, SOURCE_KINDS } from "@/lib/types";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

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

  const result = await runSearch({
    query,
    sources: validSources,
    kinds: validKinds,
    statuses: validStatuses,
    chain,
  });

  return NextResponse.json(result);
}
