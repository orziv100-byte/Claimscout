import { createHash } from "node:crypto";

export function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/https?:\/\//g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

export function hostOf(url?: string): string | undefined {
  if (!url) return undefined;
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return undefined;
  }
}

export function leadFingerprint(input: {
  catalogId?: string;
  chain?: string;
  contract?: string;
  officialHost?: string;
  projectName: string;
  kind: string;
}): string {
  if (input.catalogId) return `catalog:${input.catalogId}`;
  const contract = input.contract?.trim().toLowerCase();
  if (contract && input.chain) return `contract:${input.chain}:${contract}`;
  if (input.officialHost) return `host:${input.officialHost}:${input.kind}`;
  return `name:${slug(input.projectName)}:${input.kind}`;
}

export function resourceHash(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 32);
}

export function resourceKey(kind: string, urlOrId: string): string {
  return `${kind}:${urlOrId.toLowerCase()}`;
}
