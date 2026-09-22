import { guardedJson } from "@/lib/api-guard";
import { readCatalogWatch, captureCatalogWatch } from "@/lib/watch-run";
import { isResponse, requireScan, requireUser } from "@/lib/request-guard";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const refresh = searchParams.get("refresh") === "1";

  if (refresh) {
    const authed = requireScan(request);
    if (isResponse(authed)) return authed;
    return guardedJson(request, "catalog-watch", "light", () => captureCatalogWatch(), "watch:refresh");
  }

  const authed = requireUser(request, { allowUnverified: true });
  if (isResponse(authed)) return authed;

  return guardedJson(
    request,
    "catalog-watch-read",
    "light",
    async () => {
      const current = readCatalogWatch();
      if (current) return current;
      return {
        snapshot: null,
        previous: null,
        changes: [],
        openPools: [],
        unsupportedPools: [],
        digest: "",
        refreshed: false,
      };
    },
    "watch:read",
  );
}
