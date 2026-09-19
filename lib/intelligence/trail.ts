import { SsrfError, assertSafeUrl, type LookupFn } from "../ssrf.ts";
import { hostOf } from "./fingerprint.ts";
import type { HuntRecord, HuntTask, LeadRecord } from "./types.ts";

const GITHUB_RE = /^https?:\/\/github\.com\/([A-Za-z0-9_.-]+)(?:\/([A-Za-z0-9_.-]+))?/i;

export type DerivedTarget = {
  url: string;
  depth: number;
  fromLeadId: string;
  reason: string;
};

export function githubParts(url?: string): { org: string; repo?: string } | null {
  if (!url) return null;
  const match = GITHUB_RE.exec(url);
  if (!match) return null;
  return { org: match[1], repo: match[2] };
}

export function deriveTargets(lead: LeadRecord, depth: number): DerivedTarget[] {
  const out: DerivedTarget[] = [];
  const seen = new Set<string>();
  function add(url: string | undefined, reason: string) {
    if (!url) return;
    const key = url.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ url, depth, fromLeadId: lead.id, reason });
  }
  add(lead.github, "Lead GitHub URL");
  const parts = githubParts(lead.github);
  if (parts) {
    add(`https://github.com/${parts.org}`, "GitHub organization");
    if (parts.repo) add(`https://github.com/${parts.org}/${parts.repo}`, "GitHub repository");
  }
  if (lead.officialDocumentation) add(lead.officialDocumentation, "Official documentation");
  if (lead.officialDomain) add(`https://${lead.officialDomain}/`, "Official domain");
  for (const evidence of lead.evidence) {
    if (evidence.url) add(evidence.url, evidence.label);
  }
  return out;
}

export async function assertPublicTarget(url: string, lookup?: LookupFn): Promise<URL> {
  return assertSafeUrl(url, lookup ? { lookup } : {});
}

export function trailAllowed(hunt: HuntRecord, url: string, depth: number): { ok: true } | { ok: false; reason: string } {
  if (depth > hunt.maxTrailDepth) return { ok: false, reason: "Maximum investigation depth reached." };
  if (hunt.trailUsed >= hunt.maxDerivedTargets) return { ok: false, reason: "Maximum derived targets reached." };
  const key = url.toLowerCase();
  if (hunt.seenUrls.includes(key)) return { ok: false, reason: "URL already inspected." };
  return { ok: true };
}

export function enqueueTrail(hunt: HuntRecord, lead: LeadRecord, depth: number): number {
  const nextDepth = depth + 1;
  if (nextDepth > hunt.maxTrailDepth) return 0;
  let added = 0;
  for (const target of deriveTargets(lead, nextDepth)) {
    const allowed = trailAllowed(hunt, target.url, target.depth);
    if (!allowed.ok) continue;
    hunt.seenUrls.push(target.url.toLowerCase());
    const idx = hunt.queue.findIndex((task) => task.kind === "finalize");
    const task = { kind: "trail" as const, url: target.url, depth: target.depth, fromLeadId: target.fromLeadId };
    if (idx === -1) hunt.queue.push(task);
    else hunt.queue.splice(idx, 0, task);
    hunt.trailUsed += 1;
    added += 1;
    if (hunt.trailUsed >= hunt.maxDerivedTargets) break;
  }
  return added;
}

export function markTrailUsed(hunt: HuntRecord): void {
  hunt.trailUsed += 1;
}

export function isSsrfBlocked(err: unknown): boolean {
  return err instanceof SsrfError || (err instanceof Error && err.name === "SsrfError");
}

export function hostPattern(url: string): string | undefined {
  return hostOf(url);
}

export type TrailTask = Extract<HuntTask, { kind: "trail" }>;
