import { runWalletMonitor } from "../lib/engine/monitor.ts";

async function main() {
  const result = await runWalletMonitor();
  console.log(
    JSON.stringify(
      {
        ranAt: result.ranAt,
        skipped: result.skipped,
        wallets: result.wallets.length,
        alerted: result.wallets.filter((row) => row.alerted).length,
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
