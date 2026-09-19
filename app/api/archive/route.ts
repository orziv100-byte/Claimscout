import { guardedJson } from "@/lib/api-guard";
import { cdxSearch, waybackAvailable } from "@/lib/sources/wayback";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 20;

export async function GET(request: Request) {
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
    `archive:${url}`,
  );
}
