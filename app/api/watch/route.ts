import { guardedJson } from "@/lib/api-guard";
import { readCatalogWatch, captureCatalogWatch } from "@/lib/watch-run";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const refresh = searchParams.get("refresh") === "1";

  if (refresh) {
    return guardedJson(request, "catalog-watch", "light", () => captureCatalogWatch(), "watch:refresh");
  }

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
        digest: "",
        refreshed: false,
      };
    },
    "watch:read",
  );
}
