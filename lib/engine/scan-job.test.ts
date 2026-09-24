import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  getWalletScanJob,
  putWalletScanJobForTests,
  resetWalletScanJobsForTests,
  walletScanJobKey,
} from "./scan-job.ts";

const ADDR = "0x0000000000000000000000000000000000000001";

test("scan jobs are isolated per user+wallet", () => {
  resetWalletScanJobsForTests();
  assert.equal(walletScanJobKey("user-a", ADDR), `user-a:${ADDR}`);
  putWalletScanJobForTests("user-a", ADDR, "running");
  assert.equal(getWalletScanJob(ADDR, "user-a")?.status, "running");
  assert.equal(getWalletScanJob(ADDR, "user-b"), null);
  assert.equal(getWalletScanJob(ADDR), null);
  resetWalletScanJobsForTests();
});

test("server wallet jobs do not persist or emit MCP wallet events", () => {
  const source = readFileSync(new URL("./scan-job.ts", import.meta.url), "utf8");
  assert.match(source, /persist:\s*false/);
  assert.doesNotMatch(source, /recordScanMcpEvents/);
  assert.doesNotMatch(source, /trackWalletScan/);
  const onchain = readFileSync(new URL("../../app/api/onchain/route.ts", import.meta.url), "utf8");
  assert.doesNotMatch(onchain, /updateUser/);
});
