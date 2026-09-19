import { cached, fetchWithTimeout, readJsonLimited } from "../http";
import { mapLimit, readResourceSnapshot } from "../resource-guard";
import { inferKind, shouldBlockDiscovery } from "../safety";
import type { DiscoveredClaim, LiveSourceResult } from "../types";

const FAUCET_AND_CLAIM_HOSTS = [
  "freebitcoins.appspot.com",
  "faucet.bitcoin.com",
  "freebitco.in",
  "moonbit.co.in",
  "bonusbitcoin.co",
  "blockchain.info/faucet",
  "faucets.chain.link",
  "claim.ens.domains",
  "claim.cow.fi",
  "uniswap.org/blog/uni",
  "bitcointalk.org",
];

type CdxRow = {
  timestamp: string;
  original: string;
  statuscode: string;
  mimetype: string;
};

function parseCdx(json: unknown): CdxRow[] {
  if (!Array.isArray(json) || json.length < 2) return [];
  const rows = json.slice(1) as string[][];
  return rows.map((r) => ({
    timestamp: r[0],
    original: r[1],
    statuscode: r[2],
    mimetype: r[3],
  }));
}

export async function cdxSearch(urlPattern: string, limit = 12): Promise<CdxRow[]> {
  const api = `https://web.archive.org/cdx/search/cdx?url=${encodeURIComponent(urlPattern)}&output=json&fl=timestamp,original,statuscode,mimetype&filter=statuscode:200&collapse=urlkey&limit=${limit}`;
  return cached(`cdx:${urlPattern}:${limit}`, 10 * 60_000, async () => {
    const res = await fetchWithTimeout(api, 7000);
    if (!res.ok) throw new Error(`CDX HTTP ${res.status}`);
    const json = await readJsonLimited(res, 400_000);
    return parseCdx(json);
  });
}

export async function waybackAvailable(url: string): Promise<{
  available: boolean;
  snapshotUrl?: string;
  timestamp?: string;
}> {
  const api = `https://archive.org/wayback/available?url=${encodeURIComponent(url)}`;
  try {
    return await cached(`wb-av:${url}`, 10 * 60_000, async () => {
      const res = await fetchWithTimeout(api, 6000);
      if (!res.ok) return { available: false };
      const json = (await readJsonLimited(res, 80_000)) as {
        archived_snapshots?: { closest?: { available?: boolean; url?: string; timestamp?: string } };
      };
      const closest = json.archived_snapshots?.closest;
      if (closest?.available && closest.url) {
        return {
          available: true,
          snapshotUrl: closest.url,
          timestamp: closest.timestamp,
        };
      }
      return { available: false };
    });
  } catch {
    return { available: false };
  }
}

export async function searchWayback(query: string): Promise<LiveSourceResult> {
  const q = query.trim().toLowerCase();
  const hosts = FAUCET_AND_CLAIM_HOSTS.filter((h) => {
    if (!q) return true;
    return q.split(/\s+/).some((part) => h.includes(part) || part.length >= 4);
  });
  const targets = (hosts.length ? hosts : FAUCET_AND_CLAIM_HOSTS).slice(0, 3);

  const started = Date.now();
  try {
    const groups = await mapLimit(
      targets,
      1,
      async (host) => {
        if (readResourceSnapshot().level === "critical" || Date.now() - started > 10_000) return [];
        try {
          const rows = await cdxSearch(host.includes("/") ? host : `${host}/*`, 5);
          return rows.map((row) => ({ host, row }));
        } catch {
          return [];
        }
      },
      () => readResourceSnapshot().level === "critical" || Date.now() - started > 10_000,
    );

    const seenHosts = new Set<string>();
    const items: DiscoveredClaim[] = [];
    let blocked = 0;
    for (const { host, row } of groups.flat()) {
      if (seenHosts.has(host)) continue;
      seenHosts.add(host);
      const original = row.original.startsWith("http") ? row.original : `https://${row.original}`;
      const snapshotUrl = `https://web.archive.org/web/${row.timestamp}/${original}`;
      const title = `Archived page · ${host}`;
      const summary = `Wayback snapshot ${row.timestamp} of ${original}`;
      const decision = shouldBlockDiscovery({ title, summary, url: original });
      if (decision.blocked) {
        blocked += 1;
        continue;
      }
      items.push({
        id: `wayback-${row.timestamp}-${encodeURIComponent(original).slice(0, 40)}`,
        title,
        summary,
        url: original,
        kind: inferKind(`${host} ${original} ${q}`),
        source: "wayback",
        sourceLabel: "Internet Archive",
        publishedAt: snapshotDate(row.timestamp),
        legitimacy: "documented_public",
        flags: ["Historical snapshot — live claim status unknown until verified."],
        archiveUrl: snapshotUrl,
      });
    }
    return { items: items.slice(0, 18), blocked };
  } catch (err) {
    return { items: [], blocked: 0, error: err instanceof Error ? err.message : "Wayback search failed" };
  }
}

function snapshotDate(ts: string): string | undefined {
  if (!/^\d{14}$/.test(ts)) return undefined;
  const y = ts.slice(0, 4);
  const m = ts.slice(4, 6);
  const d = ts.slice(6, 8);
  return `${y}-${m}-${d}`;
}
