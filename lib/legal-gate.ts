import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { COPYRIGHT, COPYRIGHT_OWNER_NAME } from "./app-info.ts";
import { unconfiguredContacts } from "./contacts.ts";
import { inspectEnv } from "./env.ts";
import { PRIVACY_VERSION, TERMS_VERSION } from "./legal.ts";

const REQUIRED_DOCS = [
  "LICENSE",
  "COPYRIGHT.md",
  "THIRD_PARTY_NOTICES.md",
  "SECURITY.md",
  "docs/DATA_RETENTION.md",
  "docs/PROCESSORS.md",
  "docs/PAID_LAUNCH_CHECKLIST.md",
  "docs/LEGAL_AUDIT.md",
  "docs/LEGAL_READINESS.md",
] as const;

const REQUIRED_PAGES = [
  "app/terms/page.tsx",
  "app/privacy/page.tsx",
  "app/accessibility/page.tsx",
] as const;

const CLAIM_CHECKS: { id: string; re: RegExp; message: string }[] = [
  { id: "guaranteed-safe", re: /guaranteed safe/i, message: "Absolute 'guaranteed safe' claim" },
  {
    id: "wcag-certified",
    re: /Poolindex is fully compliant with WCAG|Poolindex is WCAG(?: 2\.1)? AA compliant/i,
    message: "Unsupported WCAG certification claim",
  },
  {
    id: "seed-request",
    re: /(?:enter|paste|type) your (?:seed|recovery) phrase/i,
    message: "UI appears to request a seed phrase",
  },
  {
    id: "key-request",
    re: /(?:enter|paste|type) your private key/i,
    message: "UI appears to request a private key",
  },
  {
    id: "buy-pro",
    re: /\b(?:buy now|purchase now|subscribe now)\b/i,
    message: "Pro shown as purchasable without billing",
  },
  {
    id: "session-only",
    re: /session storage only/i,
    message: "Wallet wording still says session storage only",
  },
];

export type LegalReadiness = {
  ok: boolean;
  production: boolean;
  termsVersion: string;
  privacyVersion: string;
  copyright: string;
  owner: string;
  missingDocuments: string[];
  missingContacts: string[];
  envMissing: string[];
  claimIssues: string[];
  blockers: string[];
  notes: string[];
};

function walkSourceFiles(dir: string, acc: string[] = []): string[] {
  if (!existsSync(dir)) return acc;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (
      entry.name === "node_modules" ||
      entry.name === ".git" ||
      entry.name.endsWith(".test.ts") ||
      entry.name === "legal-gate.ts"
    ) {
      continue;
    }
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walkSourceFiles(full, acc);
    else if (/\.(tsx?|md)$/.test(entry.name)) acc.push(full);
  }
  return acc;
}

export function scanProductClaims(root = process.cwd()): string[] {
  const files = ["app", "components", "lib"].flatMap((dir) => walkSourceFiles(join(root, dir)));
  const issues: string[] = [];
  for (const file of files) {
    const text = readFileSync(file, "utf8");
    for (const check of CLAIM_CHECKS) {
      if (check.re.test(text)) issues.push(`${check.message} in ${file.replace(`${root}/`, "")}`);
    }
  }
  return issues;
}

export function legalReadiness(
  env: NodeJS.ProcessEnv = process.env,
  root = process.cwd(),
): LegalReadiness {
  const envReport = inspectEnv(env);
  const missingDocuments = [...REQUIRED_DOCS, ...REQUIRED_PAGES].filter((file) => !existsSync(join(root, file)));
  const missingContacts = unconfiguredContacts(env).map((row) => `${row.role}:${row.address}`);
  const claimIssues = scanProductClaims(root);
  const blockers: string[] = [];
  const notes: string[] = [];

  if (!TERMS_VERSION || !PRIVACY_VERSION) blockers.push("Missing legal document versions");
  if (envReport.missing.length) blockers.push(`Missing secrets: ${envReport.missing.join(", ")}`);
  if (missingDocuments.length) blockers.push(`Missing documents: ${missingDocuments.join(", ")}`);
  if (envReport.production && missingContacts.length) {
    blockers.push(`Contact addresses still placeholders: ${missingContacts.join(", ")}`);
  } else if (missingContacts.length) {
    notes.push(`Contact placeholders in use (allowed in preview): ${missingContacts.join(", ")}`);
  }
  if (envReport.production && claimIssues.length) {
    blockers.push(`Product claim issues: ${claimIssues.join("; ")}`);
  } else if (claimIssues.length) {
    notes.push(`Product claim issues (preview note): ${claimIssues.join("; ")}`);
  }
  notes.push("This report is technical/legal-documentation readiness only. It is not a legal certification.");
  notes.push("WCAG 2.1 AA is an engineering target, not a claimed certified status.");

  return {
    ok: blockers.length === 0,
    production: envReport.production,
    termsVersion: TERMS_VERSION,
    privacyVersion: PRIVACY_VERSION,
    copyright: COPYRIGHT,
    owner: COPYRIGHT_OWNER_NAME,
    missingDocuments,
    missingContacts,
    envMissing: envReport.missing,
    claimIssues,
    blockers,
    notes,
  };
}
