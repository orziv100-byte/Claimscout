import { cached, fetchWithTimeout, readLimitedText } from "../http";
import { inferKind, shouldBlockDiscovery } from "../safety";
import type { DiscoveredClaim } from "../types";

function decodeDuckHref(href: string): string | null {
  try {
    const url = new URL(href, "https://html.duckduckgo.com");
    const uddg = url.searchParams.get("uddg");
    if (uddg) return uddg;
    if (url.hostname.includes("bitcointalk.org")) return url.toString();
    return null;
  } catch {
    return null;
  }
}

export async function searchBitcointalk(query: string): Promise<{
  items: DiscoveredClaim[];
  error?: string;
}> {
  const q = `site:bitcointalk.org ${query.trim() || "faucet OR giveaway OR airdrop"} claim OR redeem OR faucet`;
  const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(q)}`;

  try {
    const html = await cached(`ddg-btctalk:${q}`, 10 * 60_000, async () => {
      const res = await fetchWithTimeout(url, 7000, {
        headers: { accept: "text/html" },
      });
      if (!res.ok) throw new Error(`Search HTTP ${res.status}`);
      return await readLimitedText(res, 200_000);
    });

    const items: DiscoveredClaim[] = [];
    const seen = new Set<string>();
    const linkRe = /<a[^>]+class="[^"]*result__a[^"]*"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
    let match: RegExpExecArray | null;
    while ((match = linkRe.exec(html)) && items.length < 10) {
      const href = decodeDuckHref(match[1].replace(/&amp;/g, "&"));
      if (!href || !href.includes("bitcointalk.org")) continue;
      if (seen.has(href)) continue;
      seen.add(href);
      const title = match[2].replace(/<[^>]+>/g, "").trim() || "Bitcointalk thread";
      const blocked = shouldBlockDiscovery({ title, summary: title, url: href });
      if (blocked.blocked) continue;
      items.push({
        id: `bitcointalk-${Buffer.from(href).toString("base64url").slice(0, 16)}`,
        title,
        summary: "Forum thread surfaced via public web search of Bitcointalk. Verify the original post before treating it as a live claim.",
        url: href,
        kind: inferKind(title),
        source: "bitcointalk",
        sourceLabel: "Bitcointalk",
        legitimacy: "unverified",
        flags: [
          "Forum content can be edited or impersonated. Prefer the first post and its Wayback copy.",
        ],
        archiveUrl: `https://web.archive.org/web/*/${href}`,
      });
    }

    if (items.length === 0) {
      items.push(
        {
          id: "bitcointalk-campaigns-board",
          title: "Bitcointalk signature campaigns board",
          summary:
            "Live search returned no thread hits from this environment. The campaigns board is the canonical public index of paid signature / giveaway threads.",
          url: "https://bitcointalk.org/index.php?board=240.0",
          kind: "giveaway",
          source: "bitcointalk",
          sourceLabel: "Bitcointalk",
          legitimacy: "documented_public",
          flags: ["Fallback index — run a live thread search from your own browser if needed."],
        },
        {
          id: "bitcointalk-altcoin-board",
          title: "Bitcointalk alternate cryptocurrencies board",
          summary:
            "Historical home of altcoin faucets, bounty threads, and first-come promotional claims.",
          url: "https://bitcointalk.org/index.php?board=67.0",
          kind: "promotional",
          source: "bitcointalk",
          sourceLabel: "Bitcointalk",
          legitimacy: "documented_public",
          flags: [],
        },
      );
    }

    return { items };
  } catch (err) {
    return {
      items: [
        {
          id: "bitcointalk-campaigns-board",
          title: "Bitcointalk signature campaigns board",
          summary:
            "Bitcointalk web search was unavailable. Use the public campaigns board and Wayback Machine copies of threads.",
          url: "https://bitcointalk.org/index.php?board=240.0",
          kind: "giveaway",
          source: "bitcointalk",
          sourceLabel: "Bitcointalk",
          legitimacy: "documented_public",
          flags: [err instanceof Error ? err.message : "Search unavailable"],
        },
      ],
    };
  }
}
