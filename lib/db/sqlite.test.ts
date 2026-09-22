import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";
import { registerAccount, updateUser, DEV_INVITE } from "../auth.ts";
import { readBetaState } from "../beta-store.ts";
import {
  closeSqlite,
  countBetaState,
  migrateStateToSqlite,
  readStateFromSqlite,
  sqliteFile,
} from "./sqlite.ts";

const dir = mkdtempSync(join(tmpdir(), "poolindex-sqlite-"));
process.env.POOLINDEX_BETA_DIR = dir;
process.env.POOLINDEX_SCRYPT_N = "4";
process.env.POOLINDEX_SESSION_SECRET = "test-session-secret";
process.env.POOLINDEX_PLAN_SECRET = "test-plan-secret";
process.env.POOLINDEX_ADMIN_EMAILS = "admin@example.com";
process.env.NODE_ENV = "test";

after(() => {
  closeSqlite(sqliteFile(dir));
  rmSync(dir, { recursive: true, force: true });
});

test("sqlite migrates users and wallets and reopens WAL with matching counts", async () => {
  const created = await registerAccount({
    email: "ada@example.com",
    password: "correct-battery-staple",
    displayName: "Ada Lovelace",
    inviteCode: DEV_INVITE,
    acceptTerms: true,
    acceptPrivacy: true,
  });
  updateUser(created.user.id, { wallets: ["0x0000000000000000000000000000000000000001"], plan: "paid" }, created.user.id);
  const jsonState = readBetaState(dir);
  const jsonCounts = countBetaState(jsonState);
  assert.equal(jsonCounts.users, 1);
  assert.equal(jsonCounts.wallets, 1);

  const dbPath = sqliteFile(dir);
  const report = migrateStateToSqlite(jsonState, dbPath);
  assert.equal(report.match, true);
  assert.deepEqual(report.sqlite, report.json);

  closeSqlite(dbPath);
  const reopened = readStateFromSqlite(dbPath);
  assert.equal(reopened.users[0]?.plan, "paid");
  assert.equal(reopened.users[0]?.wallets.length, 1);
  assert.equal(reopened.users[0]?.email, "ada@example.com");
  assert.deepEqual(countBetaState(reopened), jsonCounts);
});
