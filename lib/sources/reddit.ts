import { cached, fetchWithTimeout, readJsonLimited } from "../http";
import { inferKind, publicOfferHint, scanTextFlags, shouldBlockDiscovery } from "../safety";
import type { DiscoveredClaim, LiveSourceResult } from "../types";

const SUBREDDITS = ["CryptoAirdrops", "freebitcoin", "ethereum", "BitcoinBeginners"];

type RedditChild = {
  data?: {
    id: string;
    title: string;
    selftext?: string;
    url?: string;
    permalink?: string;
    created_utc?: number;
    over_18?: boolean;
    subreddit?: string;
  };
};

export async function searchReddit(query: string): Promise<LiveSourceResult> {
  const q = query.trim() || "airdrop OR faucet OR giveaway claim";
  const url = `https://www.reddit.com/search.json?q=${encodeURIComponent(
    `${q} (airdrop OR faucet OR giveaway OR claim)`,
  )}&sort=new&t=year&limit=12`;

  try {
    const json = await cached(`reddit:${q}`, 5 * 60_000, async () => {
      const res = await fetchWithTimeout(url, 7000, {
        headers: { accept: "application/json" },
      });
      if (!res.ok) throw new Error(`Reddit HTTP ${res.status}`);
      return (await readJsonLimited(res, 400_000)) as { data?: { children?: RedditChild[] } };
    });

    const items: DiscoveredClaim[] = [];
    let blocked = 0;
    for (const child of json.data?.children ?? []) {
      const d = child.data;
      if (!d?.title) continue;
      if (d.over_18) continue;
      const permalink = d.permalink ? `https://www.reddit.com${d.permalink}` : d.url;
      if (!permalink) continue;
      const summary = (d.selftext || "").slice(0, 280) || `r/${d.subreddit} post`;
      const decision = shouldBlockDiscovery({ title: d.title, summary, url: permalink });
      if (decision.blocked) {
        blocked += 1;
        continue;
      }
      const flags = scanTextFlags(`${d.title}\n${d.selftext ?? ""}`)
        .filter((f) => f.severity !== "danger")
        .map((f) => f.message);
      if (!publicOfferHint(`${d.title} ${summary}`)) continue;
      items.push({
        id: `reddit-${d.id}`,
        title: d.title,
        summary,
        url: permalink,
        kind: inferKind(`${d.title} ${summary}`),
        source: "reddit",
        sourceLabel: d.subreddit ? `r/${d.subreddit}` : "Reddit",
        publishedAt: d.created_utc ? new Date(d.created_utc * 1000).toISOString() : undefined,
        legitimacy: SUBREDDITS.includes(d.subreddit ?? "") ? "unverified" : "unverified",
        flags: [
          "Community post — not an official announcement unless the author is the project.",
          ...flags,
        ],
      });
    }
    return { items, blocked };
  } catch (err) {
    return { items: [], blocked: 0, error: err instanceof Error ? err.message : "Reddit search failed" };
  }
}
