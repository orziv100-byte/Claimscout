import { cached, fetchWithTimeout, readJsonLimited } from "../http";
import { inferKind, shouldBlockDiscovery } from "../safety";
import type { DiscoveredClaim } from "../types";

type ArchiveDoc = {
  identifier?: string;
  title?: string;
  description?: string;
  original?: string;
};

export async function searchArchiveOrg(query: string): Promise<{
  items: DiscoveredClaim[];
  error?: string;
}> {
  const q = `${query.trim() || "bitcoin faucet airdrop"} (faucet OR airdrop OR giveaway)`;
  const url = `https://archive.org/advancedsearch.php?q=${encodeURIComponent(
    q,
  )}&fl[]=identifier&fl[]=title&fl[]=description&fl[]=original&output=json&rows=8`;

  try {
    const json = await cached(`ia:${q}`, 10 * 60_000, async () => {
      const res = await fetchWithTimeout(url, 7000);
      if (!res.ok) throw new Error(`archive.org HTTP ${res.status}`);
      return (await readJsonLimited(res, 400_000)) as { response?: { docs?: ArchiveDoc[] } };
    });

    const items: DiscoveredClaim[] = [];
    for (const doc of json.response?.docs ?? []) {
      if (!doc.identifier) continue;
      const page = `https://archive.org/details/${doc.identifier}`;
      const title = doc.title || doc.identifier;
      const summary = String(doc.description || "Internet Archive item")
        .replace(/<[^>]+>/g, "")
        .slice(0, 280);
      const blocked = shouldBlockDiscovery({ title, summary, url: page });
      if (blocked.blocked) continue;
      items.push({
        id: `archive-${doc.identifier}`,
        title,
        summary,
        url: page,
        kind: inferKind(`${title} ${summary}`),
        source: "archive_org",
        sourceLabel: "Internet Archive",
        legitimacy: "documented_public",
        flags: ["Archived item — confirm it was a public promotional offer before attempting any claim."],
        archiveUrl: page,
      });
    }
    return { items };
  } catch (err) {
    return { items: [], error: err instanceof Error ? err.message : "archive.org search failed" };
  }
}
