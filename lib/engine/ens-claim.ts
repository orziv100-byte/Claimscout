import type { Address } from "viem";
import { fetchWithTimeout, readLimitedText } from "../http.ts";

export type EnsClaim = {
  index: string;
  amount: string;
};

export type EnsLookup =
  | { kind: "claim"; claim: EnsClaim }
  | { kind: "not_json" }
  | { kind: "empty" };

export function interpretEnsClaimBody(contentType: string, body: string): EnsLookup {
  const ct = contentType.toLowerCase();
  const trimmed = body.trim();
  if (!trimmed) return { kind: "empty" };
  if (ct.includes("text/html") || trimmed.startsWith("<!") || /^<html/i.test(trimmed)) {
    return { kind: "not_json" };
  }
  try {
    const json = JSON.parse(trimmed) as Record<string, unknown>;
    if (!json || typeof json !== "object" || Array.isArray(json)) return { kind: "empty" };
    const index = json.index ?? json.Index;
    const amount = json.amount ?? json.Amount;
    if (index == null || amount == null) return { kind: "empty" };
    return { kind: "claim", claim: { index: String(index), amount: String(amount) } };
  } catch {
    return { kind: "not_json" };
  }
}

export async function lookupEnsClaim(address: Address): Promise<EnsLookup> {
  const url = `https://claim.ens.domains/api/mainnet/${address}`;
  const res = await fetchWithTimeout(url, 15_000, {
    headers: { accept: "application/json,text/plain;q=0.1" },
  });
  const type = res.headers.get("content-type") ?? "";
  const body = await readLimitedText(res, 250_000);
  return interpretEnsClaimBody(type, body);
}
