import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Address } from "viem";
import { withTimeout } from "../http.ts";
import { parsePublicAddress } from "../address.ts";
import { looksLikeSecretMaterial } from "../secrets-guard.ts";
import { runSource } from "./adapters.ts";
import { engineDataRoot } from "./paths.ts";
import { getEngineSource } from "./sources.ts";
import type { EngineFinding } from "./types.ts";

export const SANDBOX_LIMITS = {
  isolation: "same-node-process",
  reason:
    "This host cannot create a Linux user-namespace jail (uid_map). The sandbox is a permission-limited in-process adapter run, not a VM.",
  timeoutMs: 30_000,
  network: "public RPC and official HTTPS already used by the adapter; no extra hosts",
  secrets: "none. Production session/plan/LLM keys are not passed into the adapter.",
  productionWrites: false,
  healthWrites: false,
  rollback: "Repair Restore only after human Approve. Sandbox tests do not change adapters.ts.",
};

export type SandboxTestResult = {
  sourceId: string;
  address: string;
  startedAt: string;
  elapsedMs: number;
  logPath: string;
  limits: typeof SANDBOX_LIMITS;
  finding: {
    id: string;
    sourceId: string;
    verification: EngineFinding["verification"];
    eligibility?: EngineFinding["eligibility"];
    title: string;
    detail: string;
    officialUrl?: string;
    sourceStatus: EngineFinding["sourceStatus"];
    amount?: string;
    symbol?: string;
  };
};

function publicFinding(finding: EngineFinding) {
  return {
    id: finding.id,
    sourceId: finding.sourceId,
    verification: finding.verification,
    eligibility: finding.eligibility,
    title: finding.title,
    detail: finding.detail,
    officialUrl: finding.officialUrl,
    sourceStatus: finding.sourceStatus,
    amount: finding.amount,
    symbol: finding.symbol,
  };
}

export async function sandboxTestAdapter(sourceId: string, rawAddress: string): Promise<SandboxTestResult> {
  if (looksLikeSecretMaterial(sourceId) || looksLikeSecretMaterial(rawAddress)) {
    throw new Error("Sandbox rejected secret material.");
  }
  const source = getEngineSource(sourceId);
  if (!source) throw new Error(`Unknown source ${sourceId}.`);
  const parsed = parsePublicAddress(rawAddress);
  if (!parsed.ok) throw new Error("Sandbox needs a public 0x address.");
  const startedAt = new Date().toISOString();
  const t0 = Date.now();
  const finding = await withTimeout(runSource(source, parsed.address as Address), SANDBOX_LIMITS.timeoutMs, `sandbox:${sourceId}`);
  const elapsedMs = Date.now() - t0;
  const dir = join(engineDataRoot(), "sandbox");
  mkdirSync(dir, { recursive: true });
  const logPath = join(dir, `${startedAt.replace(/[:.]/g, "-")}-${sourceId}.json`);
  const result: SandboxTestResult = {
    sourceId,
    address: parsed.address,
    startedAt,
    elapsedMs,
    logPath,
    limits: SANDBOX_LIMITS,
    finding: publicFinding(finding),
  };
  writeFileSync(logPath, `${JSON.stringify(result, null, 2)}\n`);
  return result;
}
