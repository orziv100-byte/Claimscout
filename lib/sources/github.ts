import { cached, fetchWithTimeout, readJsonLimited } from "../http";
import { inferKind, publicOfferHint, shouldBlockDiscovery } from "../safety";
import type { DiscoveredClaim } from "../types";

type GithubRepo = {
  id: number;
  full_name: string;
  html_url: string;
  description: string | null;
  created_at: string;
  updated_at: string;
  stargazers_count: number;
  owner: { login: string };
};

type GithubSearch = {
  items?: GithubRepo[];
  message?: string;
};

const AUTOMATION_RE =
  /\b(auto-?claim|autoclaimer|automator|faucetware|auto-?booster|clicker|\w*bot|auto (?:connect|farm|claim))\b/i;

function looksLikeAutomation(text: string): boolean {
  return AUTOMATION_RE.test(text);
}

function githubHeaders(): HeadersInit {
  const headers: Record<string, string> = {
    accept: "application/vnd.github+json",
  };
  if (process.env.GITHUB_TOKEN) {
    headers.authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }
  return headers;
}

export async function searchGitHub(query: string): Promise<{
  items: DiscoveredClaim[];
  error?: string;
}> {
  const trimmed = query.trim();
  const q = /faucet/i.test(trimmed)
    ? `${trimmed} crypto faucet`
    : `${trimmed} token airdrop`;

  const url = `https://api.github.com/search/repositories?q=${encodeURIComponent(q)}&sort=stars&per_page=12`;

  try {
    const data = await cached(`gh:${q}`, 5 * 60_000, async () => {
      const res = await fetchWithTimeout(url, 10000, { headers: githubHeaders() });
      const json = (await readJsonLimited(res, 400_000)) as GithubSearch;
      if (!res.ok) {
        throw new Error(json.message || `GitHub HTTP ${res.status}`);
      }
      return json;
    });

    const items: DiscoveredClaim[] = [];
    for (const repo of data.items ?? []) {
      const title = repo.full_name;
      const summary = repo.description || "GitHub repository matching a public claim query.";
      if (looksLikeAutomation(`${title} ${summary}`)) continue;
      if (/\b(apple airdrop|file transfer|opendrop|localsend)\b/i.test(`${title} ${summary}`)) continue;
      if (!/\b(token|crypto|merkle|erc-?20|faucet|web3|ethereum|bitcoin|airdrop)\b/i.test(`${title} ${summary}`)) continue;
      const blocked = shouldBlockDiscovery({ title, summary, url: repo.html_url });
      if (blocked.blocked) continue;
      if (!publicOfferHint(`${title} ${summary}`) && !/airdrop|faucet|merkle|claim/i.test(title)) {
        continue;
      }
      items.push({
        id: `github-${repo.id}`,
        title,
        summary,
        url: repo.html_url,
        kind: inferKind(`${title} ${summary}`),
        source: "github",
        sourceLabel: "GitHub",
        publishedAt: repo.created_at,
        legitimacy: repo.stargazers_count >= 50 ? "documented_public" : "unverified",
        flags:
          repo.stargazers_count < 5
            ? ["Low stars — treat as unverified until you read the repo."]
            : [],
      });
    }
    return { items };
  } catch (err) {
    return { items: [], error: err instanceof Error ? err.message : "GitHub search failed" };
  }
}
