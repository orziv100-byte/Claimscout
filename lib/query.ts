export const QUERY_FILLER = new Set([
  "a",
  "an",
  "and",
  "airdrop",
  "airdrops",
  "claim",
  "claimed",
  "for",
  "of",
  "the",
  "to",
  "token",
  "tokens",
  "unclaimed",
]);

/** Distinctive tokens for catalog/GitHub search. Keeps AND matching without filler words wiping the result. */
export function distinctiveSearchTokens(query: string): string[] {
  const parts = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return [];
  const core = parts.filter((part) => !QUERY_FILLER.has(part) && part.length > 1);
  return core.length > 0 ? core : parts;
}
