import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import {
  APP_NAME,
  BRAND_NAME,
  BRAND_REGISTRATION_CLAIMED,
  BRAND_WORD_MARK,
  COPYRIGHT_NOTICE,
  TRADEMARK_STATUS_NOTE,
} from "./app-info.ts";
import { TERMS_SECTIONS } from "./legal.ts";
import { legalReadiness } from "./legal-gate.ts";
import { PLANS } from "./plan.ts";

function walk(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === ".git" || entry.name === "var" || entry.name.startsWith(".")) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full, acc);
    else if (/\.(ts|tsx|md|json)$/.test(entry.name) && !entry.name.endsWith(".test.ts")) acc.push(full);
  }
  return acc;
}

test("PoolIndex is the product brand and is not claimed as a registered trademark", () => {
  assert.equal(BRAND_NAME, "PoolIndex");
  assert.equal(BRAND_WORD_MARK, "PoolIndex");
  assert.equal(APP_NAME, "PoolIndex");
  assert.equal(BRAND_REGISTRATION_CLAIMED, false);
  assert.doesNotMatch(TRADEMARK_STATUS_NOTE, /registered-mark symbol is used/);
  assert.doesNotMatch(TRADEMARK_STATUS_NOTE, /is a registered trademark/i);
  assert.match(COPYRIGHT_NOTICE, /not a trademark registration of the PoolIndex name/);
  const brand = TERMS_SECTIONS.find((section) => section.heading === "Brand name");
  assert.ok(brand);
  assert.match(brand.body, /cannot establish trademark registration/);
  assert.equal(PLANS.paid.name, "PoolIndex Pro");
});

test("trademark readiness document exists and forbids fabricated registration claims", () => {
  const text = readFileSync(new URL("../docs/TRADEMARK_READINESS.md", import.meta.url), "utf8");
  assert.match(text, /\*\*Exact mark:\*\* PoolIndex/);
  assert.match(text, /First public \/ commercial use/i);
  assert.match(text, /\*\*UNKNOWN\*\*/);
  assert.match(text, /TRADEMARK REGISTRATION — OWNER\/LAWYER ACTION REQUIRED/);
  assert.match(text, /LEGAL REVIEW REQUIRED/);
  assert.match(text, /Software edits, copyright notices, and this markdown file \*\*cannot\*\* register a trademark/);
  assert.match(text, /HISTORICAL RECORD — KEEP/);
  assert.match(text, /INTERNAL INFRASTRUCTURE — OPTIONAL/);
  assert.match(text, /e33931fcb8/);
  assert.match(text, /does \*\*not\*\* state that PoolIndex is a registered trademark/);
  assert.match(text, /Do \*\*not\*\* conclude that PoolIndex is globally available/);
});

test("current source tree has no leftover Claim Scout product branding", () => {
  const root = process.cwd();
  const hits: string[] = [];
  for (const file of walk(root)) {
    if (file.includes("/docs/TRADEMARK_READINESS.md")) continue;
    if (file.includes("/docs/OSS_RESEARCH.md")) continue;
    const text = readFileSync(file, "utf8");
    if (/Claim Scout|ClaimScout|Claimscout|claimscout/i.test(text)) hits.push(file.replace(`${root}/`, ""));
  }
  assert.deepEqual(hits, []);
});

test("legal readiness includes trademark document and does not flag ® denials", () => {
  assert.equal(existsSync(join(process.cwd(), "docs/TRADEMARK_READINESS.md")), true);
  const preview = legalReadiness({ NODE_ENV: "test" });
  assert.equal(preview.missingDocuments.includes("docs/TRADEMARK_READINESS.md"), false);
  assert.equal(preview.claimIssues.length, 0);
});
