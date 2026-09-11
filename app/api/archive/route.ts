import { cdxSearch, waybackAvailable } from "@/lib/sources/wayback";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get("url");
  if (!url) {
    return NextResponse.json({ error: "url is required" }, { status: 400 });
  }

  const [availability, snapshots] = await Promise.all([
    waybackAvailable(url),
    cdxSearch(url, 20).catch(() => []),
  ]);

  return NextResponse.json({
    url,
    availability,
    snapshots: snapshots.map((row) => ({
      timestamp: row.timestamp,
      original: row.original,
      snapshotUrl: `https://web.archive.org/web/${row.timestamp}/${row.original}`,
    })),
  });
}
