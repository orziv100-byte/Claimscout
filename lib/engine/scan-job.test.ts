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
