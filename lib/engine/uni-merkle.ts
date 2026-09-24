import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fetchWithTimeout, readJsonLimited } from "../http.ts";
import { engineDataRoot } from "./paths.ts";

export type UniClaim = {
  index: number | string;
  amount: string;
};

export type UniChunkMap = Record<string, string>;

const MAPPING_URLS = [
  "https://raw.githubusercontent.com/Uniswap/mrkl-drop-data-chunks/main/chunks/mapping.json",
  "https://cdn.jsdelivr.net/gh/Uniswap/mrkl-drop-data-chunks@main/chunks/mapping.json",
];

function chunkUrl(first: string, host: "github" | "jsdelivr"): string {
  const file = `${first.toLowerCase()}.json`;
  if (host === "jsdelivr") {
    return `https://cdn.jsdelivr.net/gh/Uniswap/mrkl-drop-data-chunks@main/chunks/${file}`;
  }
  return `https://raw.githubusercontent.com/Uniswap/mrkl-drop-data-chunks/main/chunks/${file}`;
}

function cacheDir(): string {
  return join(engineDataRoot(), "cache");
}

function mappingPath(): string {
  return join(cacheDir(), "uni-mapping.json");
}

export function pickUniChunk(mapping: UniChunkMap, address: string): { first: string; last: string } | null {
  const target = address.toLowerCase();
  const firsts = Object.keys(mapping)
    .map((key) => key.toLowerCase())
    .sort();
  let lo = 0;
  let hi = firsts.length - 1;
  let chosen = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (firsts[mid] <= target) {
      chosen = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  if (chosen < 0) return null;
  const first = firsts[chosen];
  const rawLast = mapping[first] ?? mapping[Object.keys(mapping).find((key) => key.toLowerCase() === first) ?? ""];
  if (!rawLast) return null;
  const last = rawLast.toLowerCase();
  if (target > last) return null;
  return { first, last };
}

export function claimFromChunk(chunk: Record<string, UniClaim>, address: string): UniClaim | null {
  if (chunk[address]) return chunk[address];
  const lower = address.toLowerCase();
  if (chunk[lower]) return chunk[lower];
  for (const [key, value] of Object.entries(chunk)) {
    if (key.toLowerCase() === lower) return value;
  }
  return null;
}

function readDiskMapping(): UniChunkMap | null {
  try {
    const raw = JSON.parse(readFileSync(mappingPath(), "utf8")) as { expires: number; mapping: UniChunkMap };
    if (raw.expires > Date.now() && raw.mapping && typeof raw.mapping === "object") return raw.mapping;
  } catch {
    /* miss */
  }
  return null;
}

function writeDiskMapping(mapping: UniChunkMap): void {
  mkdirSync(cacheDir(), { recursive: true });
  const dest = mappingPath();
  const tmp = `${dest}.${process.pid}.tmp`;
  writeFileSync(tmp, `${JSON.stringify({ expires: Date.now() + 24 * 60 * 60 * 1000, mapping })}\n`);
  renameSync(tmp, dest);
}

async function fetchJson<T>(url: string, maxBytes: number): Promise<T> {
  const res = await fetchWithTimeout(url, 8_000, { headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`HTTP ${res.status} for merkle data`);
  return readJsonLimited<T>(res, maxBytes);
}

export async function loadUniMapping(): Promise<UniChunkMap> {
  const disk = readDiskMapping();
  if (disk) return disk;
  let lastError: unknown;
  for (const url of MAPPING_URLS) {
    try {
      const mapping = await fetchJson<UniChunkMap>(url, 900_000);
      if (!mapping || typeof mapping !== "object") continue;
      writeDiskMapping(mapping);
      return mapping;
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("UNI merkle mapping unavailable");
}

export async function loadUniClaim(address: string): Promise<UniClaim | null> {
  const mapping = await loadUniMapping();
  const picked = pickUniChunk(mapping, address);
  if (!picked) return null;
  let lastError: unknown;
  for (const host of ["github", "jsdelivr"] as const) {
    try {
      const chunk = await fetchJson<Record<string, UniClaim>>(chunkUrl(picked.first, host), 700_000);
      return claimFromChunk(chunk, address);
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("UNI merkle chunk unavailable");
}
