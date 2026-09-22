import { guardedJson } from "@/lib/api-guard";
import { publicTicker } from "@/lib/engine/markets";
import { limitPublicTicker } from "@/lib/rate-limit";
import { rateLimitedResponse } from "@/lib/request-guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 15;

export async function GET(request: Request) {
  const limited = limitPublicTicker(request);
  if (!limited.ok) return rateLimitedResponse(limited);
  return guardedJson(request, "markets-ticker", "light", () => publicTicker(), "markets-ticker");
}
