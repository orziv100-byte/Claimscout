import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, beforeEach, test } from "node:test";
import { DEV_INVITE, listUsers, registerAccount } from "./auth.ts";
import { mutateBetaState } from "./beta-store.ts";
import { CONTACT_PLACEHOLDERS, contactEntry, contactLine, PUBLIC_CONTACT_DEFAULTS, unconfiguredContacts } from "./contacts.ts";
import {
  acceptCurrentLegal,
  createPrivacyRequest,
  processDeletionRequest,
  requestAccountDeletion,
} from "./deletion.ts";
import { EXTERNAL_CLAIM_WARNING, LEAD_RESEARCH_DISCLAIMER, WALLET_DISCLOSURE } from "./disclosures.ts";
import { LEAD_STATUS_LABEL } from "./labels.ts";
import { legalReadiness, scanProductClaims } from "./legal-gate.ts";
import { ACCESSIBILITY_VERSION, DISCLAIMER_SECTIONS, EULA_SECTIONS, needsLegalReacceptance, PRIVACY_SECTIONS, PRIVACY_VERSION, TERMS_SECTIONS, TERMS_VERSION } from "./legal.ts";
import { PLANS } from "./plan.ts";

const dir = mkdtempSync(join(tmpdir(), "poolindex-legal-"));
process.env.POOLINDEX_BETA_DIR = dir;
process.env.POOLINDEX_SCRYPT_N = "4";
process.env.POOLINDEX_SESSION_SECRET = "test-session-secret";
process.env.POOLINDEX_PLAN_SECRET = "test-plan-secret";
process.env.POOLINDEX_ADMIN_EMAILS = "admin@example.com";
process.env.POOLINDEX_BETA_STAGE_CAP = "20";
process.env.NODE_ENV = "test";

before(() => {
  process.env.POOLINDEX_BETA_DIR = dir;
});

beforeEach(() => {
  rmSync(dir, { recursive: true, force: true });
  process.env.POOLINDEX_BETA_DIR = dir;
  process.env.POOLINDEX_BETA_STAGE_CAP = "20";
});

after(() => {
  rmSync(dir, { recursive: true, force: true });
});

const PASSWORD = "correct-battery-staple";

async function register(email: string, displayName = "Tester") {
  return registerAccount({
    email,
    password: PASSWORD,
    displayName,
    inviteCode: DEV_INVITE,
    acceptTerms: true,
    acceptPrivacy: true,
  });
}

test("registration stores current Terms and Privacy versions", async () => {
  const { user } = await register("ada@example.com", "Ada");
  assert.equal(user.termsVersion, TERMS_VERSION);
  assert.equal(user.privacyVersion, PRIVACY_VERSION);
  assert.ok(user.acceptedAt);
  assert.equal(needsLegalReacceptance(user), false);
});

test("material version change requires re-acceptance and records the new versions", async () => {
  const { user } = await register("ada@example.com", "Ada");
  mutateBetaState((state) => {
    const live = state.users.find((row) => row.id === user.id);
    if (!live) throw new Error("missing user");
    live.termsVersion = "beta-old";
    live.privacyVersion = "beta-old";
    return live;
  });
  const stale = listUsers().find((row) => row.id === user.id);
  assert.equal(needsLegalReacceptance(stale), true);
  const accepted = acceptCurrentLegal(user.id);
  assert.equal(accepted.termsVersion, TERMS_VERSION);
  assert.equal(accepted.privacyVersion, PRIVACY_VERSION);
  assert.equal(needsLegalReacceptance(accepted), false);
});

test("account deletion requires password and DELETE, and is owner-scoped", async () => {
  const a = await register("ada@example.com", "Ada");
  const b = await registerAccount({
    email: "bob@example.com",
    password: "different-battery-staple",
    displayName: "Bob",
    inviteCode: DEV_INVITE,
    acceptTerms: true,
    acceptPrivacy: true,
  });
  await assert.rejects(() => requestAccountDeletion({ userId: a.user.id, password: PASSWORD, confirm: "please" }), /Type DELETE/);
  await assert.rejects(
    () => requestAccountDeletion({ userId: b.user.id, password: PASSWORD, confirm: "DELETE" }),
    /Invalid password/,
  );
  const request = await requestAccountDeletion({ userId: a.user.id, password: PASSWORD, confirm: "DELETE" });
  assert.equal(request.userId, a.user.id);
  assert.equal(request.status, "requested");
  const bob = listUsers().find((row) => row.id === b.user.id);
  assert.equal(bob?.email, "bob@example.com");
  assert.equal(bob?.deletionStatus, "none");
});

test("admin deletion processing anonymizes the requester only", async () => {
  const a = await register("ada@example.com", "Ada");
  const b = await register("bob@example.com", "Bob");
  const admin = await register("admin@example.com", "Admin");
  const request = await requestAccountDeletion({ userId: a.user.id, password: PASSWORD, confirm: "DELETE" });
  const done = await processDeletionRequest({ requestId: request.id, actorId: admin.user.id, decision: "complete" });
  assert.equal(done.status, "completed");
  const users = listUsers();
  const ada = users.find((row) => row.id === a.user.id);
  const bob = users.find((row) => row.id === b.user.id);
  assert.equal(ada?.status, "disabled");
  assert.equal(ada?.deletionStatus, "completed");
  assert.equal(ada?.displayName, "Deleted account");
  assert.match(ada?.email ?? "", /@closed\.invalid$/);
  assert.deepEqual(ada?.wallets, []);
  assert.equal(bob?.email, "bob@example.com");
  assert.equal(bob?.displayName, "Bob");
  assert.equal(bob?.deletionStatus, "none");
});

test("privacy requests are recorded for the authenticated user id only", async () => {
  const a = await register("ada@example.com", "Ada");
  const row = createPrivacyRequest({ userId: a.user.id, type: "access", message: "Please send my account record." });
  assert.equal(row.userId, a.user.id);
  assert.equal(row.type, "access");
  assert.equal(row.status, "open");
});

test("wallet disclosure matches session storage plus account storage and public-address-only rules", () => {
  assert.match(WALLET_DISCLOSURE, /public 0x addresses only/i);
  assert.match(WALLET_DISCLOSURE, /session storage/);
  assert.match(WALLET_DISCLOSURE, /stored on your account/);
  assert.match(WALLET_DISCLOSURE, /never requests or stores private keys/);
  const wallets = TERMS_SECTIONS.find((section) => section.heading === "Public wallet addresses only");
  const privacy = PRIVACY_SECTIONS.find((section) => section.heading === "Public wallet addresses");
  assert.match(wallets?.body ?? "", /session storage/);
  assert.match(wallets?.body ?? "", /account/);
  assert.match(privacy?.body ?? "", /user\.wallets/);
  assert.doesNotMatch(WALLET_DISCLOSURE, /session storage only/i);
  assert.doesNotMatch(EXTERNAL_CLAIM_WARNING, /guaranteed safe/i);
  assert.match(EXTERNAL_CLAIM_WARNING, /Never enter a seed phrase/);
  assert.match(LEAD_RESEARCH_DISCLAIMER, /not money owed/);
});

test("legal pages, contacts, and versions are present", () => {
  const root = process.cwd();
  for (const file of [
    "app/terms/page.tsx",
    "app/privacy/page.tsx",
    "app/accessibility/page.tsx",
    "app/download/page.tsx",
    "app/eula/page.tsx",
    "app/disclaimer/page.tsx",
    "LICENSE",
    "COPYRIGHT.md",
    "THIRD_PARTY_NOTICES.md",
    "SECURITY.md",
    "docs/DATA_RETENTION.md",
    "docs/PROCESSORS.md",
    "docs/PAID_LAUNCH_CHECKLIST.md",
    "docs/LEGAL_AUDIT.md",
    "docs/LEGAL_READINESS.md",
  ]) {
    assert.equal(existsSync(join(root, file)), true, file);
  }
  assert.equal(TERMS_VERSION, "beta-2026-09-23.1");
  assert.equal(PRIVACY_VERSION, "beta-2026-09-22.1");
  assert.equal(ACCESSIBILITY_VERSION, "beta-2026-09-22.1");
  assert.equal(contactEntry("privacy").address, PUBLIC_CONTACT_DEFAULTS.privacy);
  assert.equal(contactEntry("privacy").configured, true);
  assert.equal(contactLine("privacy"), "privacy@poolindex.app");
  assert.doesNotMatch(contactLine("privacy"), /POOLINDEX_DOMAIN/);
  assert.doesNotMatch(contactLine("privacy"), /configuration required/);
  assert.equal(CONTACT_PLACEHOLDERS.privacy, "privacy@POOLINDEX_DOMAIN");
  assert.equal(unconfiguredContacts({}).length, 0);
  const configured = contactEntry("privacy", { POOLINDEX_CONTACT_PRIVACY: "privacy@example.com" });
  assert.equal(configured.configured, true);
  assert.equal(configured.address, "privacy@example.com");
});

test("accessibility basics: skip link, language, labels, Deep Hunt textual status", () => {
  const layout = readFileSync(new URL("../app/layout.tsx", import.meta.url), "utf8");
  assert.match(layout, /lang="en"/);
  assert.match(layout, /id="main-content"/);
  assert.match(layout, /SkipLink/);
  const skip = readFileSync(new URL("../components/skip-link.tsx", import.meta.url), "utf8");
  assert.match(skip, /Skip to main content/);
  const auth = readFileSync(new URL("../components/auth-forms.tsx", import.meta.url), "utf8");
  const google = readFileSync(new URL("../components/google-continue.tsx", import.meta.url), "utf8");
  assert.match(auth, /<label className="text-sm">\s*Email/s);
  assert.match(google, /Continue with Google/);
  assert.doesNotMatch(auth, /GOOGLE_CLIENT_SECRET/);
  assert.doesNotMatch(google, /GOOGLE_CLIENT_SECRET/);
  const start = readFileSync(new URL("../app/api/auth/google/start/route.ts", import.meta.url), "utf8");
  assert.match(start, /GOOGLE_NOT_CONFIGURED/);
  assert.match(start, /NextResponse\.redirect\(dest\)/);
  assert.doesNotMatch(start, /GOOGLE_CLIENT_SECRET/);
  assert.match(auth, /id="accept-terms"/);
  assert.match(auth, /id="accept-privacy"/);
  assert.match(auth, /role="alert"/);
  const hunt = readFileSync(new URL("../components/hunt-live-status.tsx", import.meta.url), "utf8");
  assert.match(hunt, /aria-live="polite"/);
  assert.doesNotMatch(hunt, /aria-live[\s\S]{0,80}elapsed/s);
  assert.equal(LEAD_STATUS_LABEL.investigating, "Investigating");
  assert.equal(LEAD_STATUS_LABEL.reviewable, "Reviewable");
  assert.equal(LEAD_STATUS_LABEL.rejected, "Rejected");
  assert.equal(LEAD_STATUS_LABEL.potential_risk, "Potential risk");
  const card = readFileSync(new URL("../components/lead-card.tsx", import.meta.url), "utf8");
  assert.match(card, /LEAD_STATUS_LABEL\[lead\.status\]/);
});

test("PoolIndex Pro Sandbox checkout is server-authoritative", () => {
  assert.match(PLANS.paid.summary, /PayPal Sandbox/);
  const upgrade = readFileSync(new URL("../components/upgrade-form.tsx", import.meta.url), "utf8");
  assert.match(upgrade, /SubscriptionPanel/);
  assert.doesNotMatch(upgrade, /buy now|purchase now/i);
  const coverage = readFileSync(new URL("../app/coverage/page.tsx", import.meta.url), "utf8");
  assert.match(coverage, /Request Coverage/);
  assert.match(coverage, /does not buy Eligible/i);
  assert.doesNotMatch(coverage, /Fix broken sources/);
  const asset = readFileSync(new URL("../components/asset-brief.tsx", import.meta.url), "utf8");
  assert.match(asset, /does not invent Eligible/i);
  assert.doesNotMatch(asset, /guaranteed safe/i);
  const termsPlans = TERMS_SECTIONS.find((section) => section.heading === "Plans");
  assert.match(termsPlans?.body ?? "", /PayPal Sandbox/);
  assert.match(termsPlans?.body ?? "", /Live PayPal/);
});

test("public download page is unpaid and has required legal links", () => {
  const download = readFileSync(new URL("../app/download/page.tsx", import.meta.url), "utf8");
  assert.match(download, /Download PoolIndex EXE/);
  assert.match(download, /does not require payment/);
  assert.match(download, /does\s+not guarantee/s);
  assert.match(download, /macOS/);
  assert.match(download, /Unsigned Closed Beta/);
  assert.match(download, /href="\/privacy"/);
  assert.match(download, /href="\/terms"/);
  assert.match(download, /href="\/eula"/);
  assert.match(download, /href="\/disclaimer"/);
  assert.doesNotMatch(download, /\/api\/billing\/checkout/);
  assert.doesNotMatch(download, /PAYPAL_CLIENT_SECRET/);
  assert.doesNotMatch(download, /buy now|purchase now|subscribe now/i);
  const home = readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(home, /href="\/download"/);
  assert.doesNotMatch(home, /planned \$/);
  assert.doesNotMatch(home, /Wallet check|Live scan|Hunts|Catalog|Connect agent|Paste a public 0x/i);
  const proxy = readFileSync(new URL("../proxy.ts", import.meta.url), "utf8");
  assert.match(proxy, /isPublicWebsitePath/);
  assert.match(proxy, /isAppPath/);
  assert.match(proxy, /PORTAL_HOME/);
  assert.match(proxy, /download-ops/);
  assert.doesNotMatch(proxy, /zip\|exe\|dmg/);
  assert.doesNotMatch(proxy, /43148/);
  assert.match(proxy, /PATHNAME_HEADER/);
  assert.match(readFileSync(new URL("../lib/pathname-header.ts", import.meta.url), "utf8"), /x-poolindex-pathname/);
  assert.match(readFileSync(new URL("../lib/site-surface.ts", import.meta.url), "utf8"), /"\/download"/);
  assert.match(readFileSync(new URL("../lib/site-surface.ts", import.meta.url), "utf8"), /"\/eula"/);
  assert.match(readFileSync(new URL("../lib/site-surface.ts", import.meta.url), "utf8"), /"\/disclaimer"/);
  assert.match(readFileSync(new URL("../components/app-shell.tsx", import.meta.url), "utf8"), /AppChrome/);
  const publicHeader = readFileSync(new URL("../components/public-marketing-header.tsx", import.meta.url), "utf8");
  assert.match(publicHeader, /Download/);
  assert.match(publicHeader, /Terms/);
  assert.match(publicHeader, /Privacy/);
  assert.match(publicHeader, /next=\/download/);
  assert.doesNotMatch(publicHeader, /Wallet check|Live scan|Hunts|Catalog|Connect agent/i);
  assert.doesNotMatch(publicHeader, /Paste 0x|header-wallet|connectInjected/);
  const chrome = readFileSync(new URL("../components/app-chrome.tsx", import.meta.url), "utf8");
  assert.match(chrome, /isAuthFunnelPath/);
  assert.match(chrome, /PublicMarketingHeader/);
  assert.match(chrome, /SiteHeader/);
  assert.match(chrome, /isAppPath/);
  assert.doesNotMatch(chrome, /Wallet check|Live scan|Hunts|Catalog/);
  const funnel = readFileSync(new URL("../components/auth-funnel-chrome.tsx", import.meta.url), "utf8");
  assert.match(funnel, /Terms of Use/);
  assert.match(funnel, /Accessibility/);
  assert.match(funnel, />\s*Info\s*</);
  assert.doesNotMatch(funnel, /Wallet check|Live scan|Hunts|Catalog/);
  const registerPage = readFileSync(new URL("../app/register/page.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(registerPage, /Google|Wallet check|Live scan/);
  const authForms = readFileSync(new URL("../components/auth-forms.tsx", import.meta.url), "utf8");
  const registerFn = authForms.slice(authForms.indexOf("export function RegisterForm"), authForms.indexOf("export function ForgotForm"));
  assert.match(registerFn, /Username/);
  assert.doesNotMatch(registerFn, /GoogleContinueButton/);
  const verifyPage = readFileSync(new URL("../app/verify/page.tsx", import.meta.url), "utf8");
  assert.match(verifyPage, /\/download/);
  const appHeader = readFileSync(new URL("../components/site-header.tsx", import.meta.url), "utf8");
  assert.match(appHeader, /Wallet check/);
  assert.match(appHeader, /Live scan/);
  assert.match(appHeader, /header-wallet/);
  const eulaFunds = EULA_SECTIONS.find((section) => section.heading === "No guarantee of funds or rewards");
  assert.match(eulaFunds?.body ?? "", /does not guarantee/);
  const disclaimerFunds = DISCLAIMER_SECTIONS.find((section) => section.heading === "No guaranteed funds or rewards");
  assert.match(disclaimerFunds?.body ?? "", /does not guarantee/);
});

test("legal readiness reporter uses public contact defaults and does not claim certification", () => {
  const preview = legalReadiness({ NODE_ENV: "test" });
  assert.equal(preview.missingDocuments.length, 0);
  assert.equal(preview.claimIssues.length, 0);
  assert.equal(preview.ok, true);
  assert.match(preview.notes.join(" "), /not a legal certification/i);
  const production = legalReadiness({
    NODE_ENV: "production",
    POOLINDEX_SESSION_SECRET: "prod-session",
    POOLINDEX_PLAN_SECRET: "prod-plan",
    POOLINDEX_ADMIN_EMAILS: "admin@example.com",
  });
  assert.equal(production.missingContacts.length, 0);
  assert.doesNotMatch(production.blockers.join(" "), /Contact addresses still placeholders/);
  assert.equal(scanProductClaims().length, 0);
});

test("Closed Beta Terms cover research-only crypto limits", () => {
  const headings = TERMS_SECTIONS.map((section) => section.heading);
  for (const heading of [
    "Service operator",
    "Brand name",
    "Closed Beta",
    "Public wallet addresses only",
    "Deep Hunt and Continuous Hunt",
    "Crypto and research limitations",
    "Governing law",
  ]) {
    assert.ok(headings.includes(heading), heading);
  }
  const crypto = TERMS_SECTIONS.find((section) => section.heading === "Crypto and research limitations");
  const what = TERMS_SECTIONS.find((section) => section.heading === "What PoolIndex is");
  assert.match(what?.body ?? "", /does not execute blockchain transactions/i);
  assert.match(crypto?.body ?? "", /irreversible/);
  assert.match(crypto?.body ?? "", /investment, financial, legal, or tax advice/);
  const publicLegal = `${TERMS_SECTIONS.map((section) => section.body).join("\n")}\n${PRIVACY_SECTIONS.map((section) => section.body).join("\n")}`;
  assert.doesNotMatch(publicLegal, /OWNER CONFIRMATION REQUIRED/);
  assert.doesNotMatch(publicLegal, /LEGAL REVIEW REQUIRED/);
  assert.doesNotMatch(publicLegal, /POOLINDEX_DOMAIN/);
  assert.doesNotMatch(publicLegal, /var\/beta/);
  assert.doesNotMatch(publicLegal, /TRADEMARK_READINESS\.md/);
});
