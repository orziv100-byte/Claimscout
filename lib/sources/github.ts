import { cached, fetchWithTimeout, readJsonLimited } from "../http";
import { inferKind, looksLikeDeveloperTooling, publicOfferHint, shouldBlockDiscovery } from "../safety";
import { distinctiveSearchTokens } from "../query";
import type { DiscoveredClaim, LiveSourceResult } from "../types";

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

function githubHeaders(): HeadersInit {
  const headers: Record<string, string> = {
    accept: "application/vnd.github+json",
  };
  if (process.env.GITHUB_TOKEN) {
    headers.authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }
  return headers;
}

export async function searchGitHub(query: string): Promise<LiveSourceResult> {
  const trimmed = query.trim();
  const tokens = distinctiveSearchTokens(trimmed);
  const q = tokens.length ? tokens.join(" ") : trimmed;

  const url = `https://api.github.com/search/repositories?q=${encodeURIComponent(q)}&sort=stars&per_page=12`;

  try {
    const data = await cached(`gh:${q}`, 5 * 60_000, async () => {
      const res = await fetchWithTimeout(url, 7000, { headers: githubHeaders() });
      const json = (await readJsonLimited(res, 400_000)) as GithubSearch;
      if (!res.ok) {
        throw new Error(json.message || `GitHub HTTP ${res.status}`);
      }
      return json;
    });

    const items: DiscoveredClaim[] = [];
    let blocked = 0;
    for (const repo of data.items ?? []) {
      const title = repo.full_name;
      const summary = repo.description || "GitHub repository matching a public claim query.";
      if (/\b(apple airdrop|file transfer|opendrop|localsend)\b/i.test(`${title} ${summary}`)) continue;
      if (!/\b(token|crypto|merkle|erc-?20|faucet|web3|ethereum|bitcoin|airdrop)\b/i.test(`${title} ${summary}`)) continue;
      if (shouldBlockDiscovery({ title, summary, url: repo.html_url }).blocked) {
        blocked += 1;
        continue;
      }
      if (looksLikeDeveloperTooling(title, summary)) {
        blocked += 1;
        continue;
      }
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
        flags: [...(repo.stargazers_count < 5 ? ["Low stars — treat as unverified until you read the repo."] : [])],
      });
    }
    return { items, blocked };
  } catch (err) {
    return { items: [], blocked: 0, error: err instanceof Error ? err.message : "GitHub search failed" };
  }
}
