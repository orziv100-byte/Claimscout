import { CATALOG, getClaimById } from "./catalog";
import { fetchWithTimeout, readLimitedText } from "./http";
import { shouldSkipOptionalWork } from "./resource-guard";
import { scanTextFlags, scanUrlFlags } from "./safety";
import { waybackAvailable } from "./sources/wayback";
import type { VerificationFlag, VerificationReport } from "./types";

function extractTitle(html: string): string | undefined {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (!m) return undefined;
  return m[1].replace(/\s+/g, " ").trim().slice(0, 140);
}

export async function verifyUrl(url: string): Promise<VerificationReport> {
  const flags: VerificationFlag[] = [...scanUrlFlags(url)];
  let live = false;
  let statusCode: number | undefined;
  let finalUrl: string | undefined;
  let title: string | undefined;
  let bodySample = "";

  try {
    const res = await fetchWithTimeout(url, 8000, { redirect: "follow" });
    statusCode = res.status;
    live = res.ok;
    finalUrl = res.url;
    const contentType = res.headers.get("content-type") || "";
    if (contentType.includes("text/html")) {
      const html = await readLimitedText(res, 50_000);
      bodySample = html;
      title = extractTitle(html);
    }
    if (finalUrl && finalUrl !== url) {
      flags.push(...scanUrlFlags(finalUrl));
    }
  } catch {
    flags.push({
      severity: "warning",
      code: "fetch_failed",
      message: "Live fetch failed. The page may be down, geo-blocked, or blocking this server.",
    });
  }

  flags.push(...scanTextFlags(`${title ?? ""}\n${bodySample}`));

  if (bodySample && /<input[^>]+type=["']password["']/i.test(bodySample) && /seed|mnemonic|private/i.test(bodySample)) {
    flags.push({
      severity: "danger",
      code: "seed_form",
      message: "Page contains a password field near seed/private-key language. Do not enter secrets.",
    });
  }

  const archive = shouldSkipOptionalWork()
    ? { available: false as const }
    : await waybackAvailable(url);
  if (archive.available) {
    flags.push({
      severity: "info",
      code: "archived",
      message: "At least one Wayback Machine snapshot exists.",
    });
  }

  const catalogMatch = matchCatalog(url, title);
  if (catalogMatch) {
    flags.push({
      severity: "info",
      code: "catalog_match",
      message: `Matches catalog entry “${catalogMatch.title}”.`,
    });
  }

  const danger = flags.some((f) => f.severity === "danger");
  const warning = flags.some((f) => f.severity === "warning");

  let verdict: VerificationReport["verdict"] = "safe_to_review";
  let verdictReason =
    "No secret-harvesting or blocked-host signals. Still review the official source before connecting a wallet.";

  if (danger) {
    verdict = "blocked";
    verdictReason =
      "Poolindex will not assist with this URL. It looks like key material, a drainer, or another out-of-policy request.";
  } else if (!live || warning) {
    verdict = "caution";
    verdictReason = live
      ? "Review the warnings before interacting. Prefer the official project domain and a Wayback copy."
      : "Page is not live from this server. Use an archive snapshot if you need to read the original offer.";
  }

  return {
    url,
    fetchedAt: new Date().toISOString(),
    live,
    statusCode,
    finalUrl,
    title,
    flags,
    archive: {
      available: archive.available,
      snapshotUrl: archive.snapshotUrl,
      timestamp: archive.timestamp,
    },
    catalogMatch,
    verdict,
    verdictReason,
  };
}

function matchCatalog(url: string, title?: string) {
  const all = [
    ...new Set(
      [
        url,
        title,
      ].filter(Boolean) as string[],
    ),
  ]
    .join(" ")
    .toLowerCase();

  for (const claim of CATALOG) {
    if (claim.officialUrl && url.startsWith(claim.officialUrl)) {
      return { id: claim.id, title: claim.title };
    }
    if (claim.sources.some((s) => url.startsWith(s.url) || s.url.startsWith(url))) {
      return { id: claim.id, title: claim.title };
    }
    if (title && claim.title.toLowerCase().split(" ").slice(0, 2).every((w) => all.includes(w.toLowerCase()))) {
      return { id: claim.id, title: claim.title };
    }
  }
  return undefined;
}

export async function inspectKnownClaim(id: string): Promise<VerificationReport | null> {
  const claim = getClaimById(id);
  const url = claim?.officialUrl || claim?.archiveUrl || claim?.sources[0]?.url;
  if (!url) return null;
  return verifyUrl(url);
}
