import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fetchWithTimeout, readLimitedText } from "../http.ts";

/** Official CoW mainnet allocation (Apache-2.0 / MIT). Fetched at runtime, not vendored. */
const ALLOCATION_URLS = [
  "https://raw.githubusercontent.com/gnosis/cow-token-allocation/2111ee1e678be345ba8b33e80be5fa0d0ed780f4/allocations-mainnet.csv",
  "https://cdn.jsdelivr.net/gh/gnosis/cow-token-allocation@2111ee1e678be345ba8b33e80be5fa0d0ed780f4/allocations-mainnet.csv",
];

export type CowAllocation = {
  account: string;
  airdrop: string;
  total: string;
};

function cachePath(): string {
  return join(process.cwd(), "var/engine/cache/cow-allocation-mainnet.json");
}

function parseCsv(text: string): Map<string, CowAllocation> {
  const out = new Map<string, CowAllocation>();
  const lines = text.split(/\r?\n/);
  const header = lines[0]?.split(",") ?? [];
  if (header[0] !== "Account") throw new Error("CoW allocation CSV header is not Account,...");
  for (const line of lines.slice(1)) {
    if (!line.trim()) continue;
    const cols = line.split(",");
    const account = cols[0]?.trim().toLowerCase();
    if (!account?.startsWith("0x") || account.length !== 42) continue;
    let total = BigInt(0);
    for (const col of cols.slice(1)) {
      const raw = col?.trim() || "0";
      if (!/^\d+$/.test(raw)) continue;
      total += BigInt(raw);
    }
    out.set(account, { account, airdrop: cols[1]?.trim() || "0", total: total.toString() });
  }
  if (out.size < 100) throw new Error(`CoW allocation CSV too small (${out.size} rows)`);
  return out;
}

function readDisk(): Map<string, CowAllocation> | null {
  try {
    const raw = JSON.parse(readFileSync(cachePath(), "utf8")) as {
      expires: number;
      rows: [string, CowAllocation][];
    };
    if (raw.expires > Date.now() && Array.isArray(raw.rows)) return new Map(raw.rows);
  } catch {
    /* miss */
  }
  return null;
}

function writeDisk(rows: Map<string, CowAllocation>) {
  mkdirSync(join(process.cwd(), "var/engine/cache"), { recursive: true });
  const dest = cachePath();
  const tmp = `${dest}.${process.pid}.tmp`;
  writeFileSync(
    tmp,
    `${JSON.stringify({ expires: Date.now() + 24 * 60 * 60 * 1000, rows: [...rows.entries()] })}\n`,
  );
  renameSync(tmp, dest);
}

export async function loadCowAllocation(): Promise<Map<string, CowAllocation>> {
  const disk = readDisk();
  if (disk) return disk;
  let lastError: unknown;
  for (const url of ALLOCATION_URLS) {
    try {
      const res = await fetchWithTimeout(url, 15_000, { headers: { accept: "text/plain,text/csv,*/*" } });
      if (!res.ok) throw new Error(`HTTP ${res.status} for CoW allocation`);
      const text = await readLimitedText(res, 2_000_000);
      const parsed = parseCsv(text);
      writeDisk(parsed);
      return parsed;
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("CoW allocation unavailable");
}

export async function lookupCowAllocation(address: string): Promise<CowAllocation | null> {
  const rows = await loadCowAllocation();
  return rows.get(address.toLowerCase()) ?? null;
}
