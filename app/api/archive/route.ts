import { guardedJson } from "@/lib/api-guard";
import { limitExpensiveEndpoint } from "@/lib/rate-limit";
import { isResponse, rateLimitedResponse, requireScan } from "@/lib/request-guard";
import { cdxSearch, waybackAvailable } from "@/lib/sources/wayback";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 20;

export async function GET(request: Request) {
  const authed = requireScan(request);
  if (isResponse(authed)) return authed;
  const limited = limitExpensiveEndpoint(request, authed.user.id, "archive");
  if (!limited.ok) return rateLimitedResponse(limited);
  const { searchParams } = new URL(request.url);
  const url = searchParams.get("url");
  if (!url) {
    return NextResponse.json({ error: "url is required" }, { status: 400 });
  }

  return guardedJson(
    request,
    "archive-lookup",
    "light",
    async () => {
      const availability = await waybackAvailable(url);
      const snapshots = await cdxSearch(url, 12).catch(() => []);
      return {
        url,
        availability,
        snapshots: snapshots.map((row) => ({
          timestamp: row.timestamp,
          original: row.original,
          snapshotUrl: `https://web.archive.org/web/${row.timestamp}/${row.original}`,
        })),
      };
    },
    `archive:${authed.user.id}:${url}`,
  );
}
