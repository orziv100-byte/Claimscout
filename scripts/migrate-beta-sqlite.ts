import { readBetaState } from "../lib/beta-store.ts";
import { closeSqlite, migrateStateToSqlite, sqliteFile } from "../lib/db/sqlite.ts";
import { existsSync, unlinkSync } from "node:fs";

const root = process.argv[2] || process.env.POOLINDEX_BETA_DIR || "var/beta";
const path = sqliteFile(root);
const state = readBetaState(root);
const report = migrateStateToSqlite(state, path);
const payload = {
  sqlitePath: report.sqlitePath,
  json: report.json,
  sqlite: report.sqlite,
  match: report.match,
};
console.log(JSON.stringify(payload));
if (!report.match) {
  closeSqlite(path);
  try {
    unlinkSync(path);
    if (existsSync(`${path}-wal`)) unlinkSync(`${path}-wal`);
    if (existsSync(`${path}-shm`)) unlinkSync(`${path}-shm`);
  } catch {
    /* still fail closed */
  }
  console.error("migrate-beta-sqlite: COUNT MISMATCH — JSON stays authoritative, sqlite removed");
  process.exit(2);
}
closeSqlite(path);
