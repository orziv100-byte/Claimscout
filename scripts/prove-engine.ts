import { parsePublicAddress } from "../lib/address.ts";
import { scanWalletEngine } from "../lib/engine/scan.ts";

async function main() {
  const raw = process.argv[2] || "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045";
  const parsed = parsePublicAddress(raw);
  if (!parsed.ok) {
    console.error(parsed.error);
    process.exit(1);
  }

  const scan = await scanWalletEngine(parsed.address);
  const summary = {
    address: scan.address,
    scannedAt: scan.scannedAt,
    elapsedNote: "Whole-scan has no 30s cap; 30s is per-adapter timeout only.",
    adapters: {
      checked: scan.summary.adaptersChecked,
      succeeded: scan.summary.adaptersSucceeded,
      failed: scan.summary.adaptersFailed,
      failures: scan.summary.failures,
    },
    findings: {
      verified: scan.summary.verified,
      uncertain: scan.summary.uncertain,
      rejected: scan.summary.rejected,
    },
    profileChains: scan.profile.chains.filter((row) => Number(row.native) > 0).map((row) => row.chainLabel),
    tokens: scan.profile.tokens.map((row) => `${row.symbol}:${row.amount}`),
    protocols: scan.profile.protocols,
    txCounts: scan.profile.chains.map((row) => `${row.chainLabel}:${row.txCount ?? "n/a"}`),
    airdrops: scan.findings
      .filter((row) => row.category === "airdrop" || row.sourceStatus === "failed")
      .map((row) => ({
        id: row.sourceId,
        status: row.sourceStatus,
        verification: row.verification,
        eligibility: row.eligibility,
        detail: row.detail,
      })),
  };
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
