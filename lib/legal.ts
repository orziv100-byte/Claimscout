import { COPYRIGHT, COPYRIGHT_OWNER_NAME, COPYRIGHT_RIGHTS_HOLDER } from "./app-info.ts";
import { contactLine } from "./contacts.ts";

export const TERMS_VERSION = "beta-2026-09-20.2";
export const PRIVACY_VERSION = "beta-2026-09-20.2";
export const ACCESSIBILITY_VERSION = "beta-2026-09-20.2";
export const LEGAL_EFFECTIVE_DATE = "2026-09-20";
export const LEGAL_UPDATED_DATE = "2026-09-20";

export const TERMS_TITLE = "Poolindex Closed Beta Terms of Use";
export const PRIVACY_TITLE = "Poolindex Privacy Notice";
export const ACCESSIBILITY_TITLE = "Poolindex Accessibility Statement";

export type LegalSection = { heading: string; body: string };

export const TERMS_SECTIONS: LegalSection[] = [
  {
    heading: "Service operator",
    body: `Poolindex is operated by ${COPYRIGHT_OWNER_NAME}, Israel. No company registration number, VAT number, registered office, or telephone number is published in this Closed Beta. OWNER CONFIRMATION REQUIRED before a public launch if a registered business name or address must appear. Contact: ${contactLine("legal")}.`,
  },
  {
    heading: "What Poolindex is",
    body: "Poolindex is a Closed Beta research, discovery, and safety-check tool. It helps invited testers search, organize, and review publicly described claims, airdrops, faucets, and similar offers from public and external sources. It is not a wallet, exchange, broker, custodian, claims processor, payment processor, or investment, legal, or tax adviser. Poolindex does not execute blockchain transactions for you. Any later signing happens only in your own wallet after you choose to approve it.",
  },
  {
    heading: "Closed Beta",
    body: "This version is a Closed Beta. Access is by invitation only. Features, limits, sources, and availability can change. Results may contain errors, omissions, or outdated third-party information. Availability is not guaranteed. Please report problems. Beta status does not excuse security or privacy negligence; it means the product is still being tested.",
  },
  {
    heading: "Eligibility and minimum age",
    body: "You may use Poolindex only if you are invited and legally able to agree to these Terms. MINIMUM USER AGE: LEGAL REVIEW REQUIRED. Until the operator confirms an age rule with counsel, do not invite testers who cannot enter a contract in their jurisdiction.",
  },
  {
    heading: "Account responsibility and invites",
    body: "You are responsible for your login details and for activity on your account. Invitation codes are personal to the Closed Beta. Do not sell, publish, or share invites. We may suspend accounts that abuse invites, overload the service, or violate these Terms.",
  },
  {
    heading: "Acceptable use",
    body: "Use Poolindex only on wallets and research you are authorized to review. Do not use it to attack systems, steal credentials, collect other people's secrets, bypass access controls, or automate claims. Do not paste seed phrases, recovery phrases, private keys, or wallet passwords.",
  },
  {
    heading: "Public wallet addresses only",
    body: "Wallet features accept public 0x addresses only. The browser may keep the address you are currently checking in session storage. The same public address is also stored on your account so Free/Pro wallet limits can be enforced. Addresses are not private keys. Poolindex never requests or stores private keys, seed phrases, recovery phrases, or wallet passwords.",
  },
  {
    heading: "Deep Hunt and Continuous Hunt",
    body: "If you start a Deep Hunt, Poolindex may continue researching public catalog, source, archive, and (on Poolindex Pro, when enabled) public blockchain information related to your query and any public wallet address you supplied. Continuous Hunt, when available on a planned Pro path, is periodic incremental research of stored public leads — not access to private chain data. You can pause or stop a hunt. Findings are research leads, not money owed to you.",
  },
  {
    heading: "Third-party services and links",
    body: "Scans and hunts may query public third-party services (for example GitHub, Wayback Machine, Internet Archive, and public RPC endpoints). Those providers have their own terms. External pages can change after Poolindex records a snapshot. A link in Poolindex is not an endorsement and is not a guarantee that the destination is safe or still offering a claim.",
  },
  {
    heading: "Crypto and research limitations",
    body: "Poolindex does not provide investment, financial, legal, or tax advice. It does not act as a broker, custodian, or wallet manager. It does not claim tokens for you. It does not guarantee eligibility, reward, profit, value, completeness, or that information remains current. You must independently verify destinations, contracts, and claim windows before connecting a wallet or signing anything. Blockchain transactions are irreversible. Network/gas fees are charged by the network, not by Poolindex. Phishing and scam pages exist; a Safety Check is not a guarantee that a third-party site is safe.",
  },
  {
    heading: "Plans",
    body: "The Free plan is limited to a smaller source set and one public wallet address. Poolindex Pro is a planned paid plan (target $40) with more sources and up to five wallets. Payment processing is not active. You cannot purchase Pro in this Closed Beta. An operator may issue a test license. Plan limits are enforced on the server.",
  },
  {
    heading: "Availability, errors, and interruption",
    body: "The service may pause, fail, or return HTTP 503 when the host is under resource pressure. Failed scans are not retried in a loop. We may suspend scanning without deleting accounts. You should not rely on Poolindex as the only record of your research.",
  },
  {
    heading: "Suspension, termination, and account closure",
    body: "We may suspend or disable accounts that violate these Terms or that abuse the Beta. You may request account closure from your account page after confirming your password and typing DELETE. Closure requests are recorded and processed by an operator. Some security logs and backups may remain for a limited period as described in the Privacy Notice and DATA_RETENTION.md.",
  },
  {
    heading: "Intellectual property",
    body: `Poolindex original product, source code, operations, user interface, visual design, documentation, and related materials are the exclusive property of ${COPYRIGHT_RIGHTS_HOLDER}. ${COPYRIGHT} You may not copy, sell, distribute, sublicense, or make commercial use of Poolindex without prior written permission from ${COPYRIGHT_OWNER_NAME}. Closed Beta access is not a license to copy or commercialize the product. Third-party packages remain under their own licenses.`,
  },
  {
    heading: "Feedback",
    body: "If you submit feedback during the Beta, you grant Poolindex a non-exclusive right to use that feedback to operate and improve the product. Do not include secrets in feedback. Feedback is not marketing consent.",
  },
  {
    heading: "Warranty disclaimer",
    body: "Poolindex is provided as-is for Closed Beta testing. To the extent permitted by law, we disclaim implied warranties of merchantability, fitness for a particular purpose, and non-infringement. This is not an extreme waiver of rights that cannot be waived in your jurisdiction. LEGAL REVIEW REQUIRED.",
  },
  {
    heading: "Limitation of liability",
    body: `To the extent permitted by law, ${COPYRIGHT_OWNER_NAME} is not liable for lost profits, lost tokens, gas fees, failed claims, third-party site changes, or indirect damages arising from Beta use. Nothing in these Terms excludes liability that cannot legally be excluded. LEGAL REVIEW REQUIRED for a jurisdiction-specific cap.`,
  },
  {
    heading: "Changes",
    body: "We may update Poolindex and these Terms. Material Terms or Privacy changes get a new version identifier. Your accepted versions are stored with your account. If the current version is newer than the version you accepted, you will be asked to review and accept again before continuing. Continued use after that acceptance means you agree to the updated Terms.",
  },
  {
    heading: "Governing law",
    body: "GOVERNING LAW AND JURISDICTION: LEGAL REVIEW REQUIRED / OWNER DECISION REQUIRED. This Closed Beta does not select a court or governing law until counsel reviews the operator's situation in Israel and any tester locations.",
  },
  {
    heading: "Contact",
    body: `Questions: ${contactLine("support")}. Legal: ${contactLine("legal")}. Privacy: ${contactLine("privacy")}.`,
  },
];

export const PRIVACY_SECTIONS: LegalSection[] = [
  {
    heading: "Who operates Poolindex",
    body: `Poolindex is operated by ${COPYRIGHT_OWNER_NAME}, Israel. Contact for privacy questions: ${contactLine("privacy")}. This notice describes what the running application actually stores. It is not a claim of certification under any privacy statute.`,
  },
  {
    heading: "Account data",
    body: "WHAT: email, scrypt password hash (not the password), optional display name, unique user ID, invite code, role, plan, account status, created/last-login timestamps. WHY: authenticate you, isolate testers, enforce invite and stage caps. WHERE: file store under var/beta/state.json on the operator host. RETENTION: while the account exists, then as in DATA_RETENTION.md. WHO: you (your own record) and Beta operators/admins. THIRD PARTIES: email/outbox delivery if a mail provider is configured.",
  },
  {
    heading: "Consent records",
    body: "WHAT: user ID, Terms version, Privacy version, acceptance timestamp. WHY: prove you accepted the documents you were shown; support later re-acceptance when versions change. WHERE: account record in var/beta/state.json. RETENTION: with the account. WHO: you and operators. Checkboxes in the UI are not sufficient by themselves — the server rejects registration without acceptTerms and acceptPrivacy.",
  },
  {
    heading: "Public wallet addresses",
    body: "WHAT: checksummed public 0x addresses you paste or connect. WHY: read-only eligibility/pool checks you request, and Free/Pro wallet-slot limits. WHERE: (1) browser sessionStorage for the address currently in the UI session; (2) the account record (user.wallets) on the server. RETENTION: on the account until you request closure or an operator removes the binding. WHO: you and operators. Poolindex does not request or store private keys, seed phrases, recovery phrases, or wallet passwords. Secret-shaped input is rejected.",
  },
  {
    heading: "Sessions and tokens",
    body: "WHAT: HMAC-signed session cookies, session IDs, email-verify and password-reset token hashes, expiry times. WHY: keep you signed in and complete verification/reset. WHERE: HTTP-only cookie plus var/beta/state.json. RETENTION: sessions expire (about 7 days) or are revoked on logout/disable; unused tokens expire. WHO: the operator host. IP addresses are not stored in the session record.",
  },
  {
    heading: "IP and security events",
    body: "WHAT: security log lines may include event type, user ID, email, optional IP (login attempts), and a short detail code. WHY: detect abuse, lockouts, and admin actions. WHERE: var/beta/security.jsonl. RETENTION: product policy in DATA_RETENTION.md; LEGAL REQUIREMENT TO CONFIRM. WHO: operators. Rate limiting also keeps short-lived in-memory IP counters that are not written as a user profile.",
  },
  {
    heading: "Scan activity and telemetry",
    body: "WHAT: scan started/completed/failed, query text (truncated), sources used, duration, item counts, blocked counts, source failures, resource-limit events, application errors, app version, user ID. WHY: debug Closed Beta quality and host protection — not advertising. WHERE: var/beta/telemetry.jsonl, var/beta/scans/{userId}.jsonl, var/beta/errors.jsonl. RETENTION: DATA_RETENTION.md. WHO: operators. Queries can be personal; they are stored to investigate failures.",
  },
  {
    heading: "Deep Hunt and leads",
    body: "WHAT: hunt records (query, plan, progress counters, public URLs seen, lead cards, evidence snippets from public sources, optional public wallet used for research, pause/stop state). WHY: persist an investigation you started so it survives refresh. WHERE: var/beta/hunts/{userId}/{huntId}.json. RETENTION: until account closure processing, then operator policy. WHO: you (your hunts) and admins (stop/stats). Continuous Hunt, if enabled later on Pro, re-reads stored public leads. Poolindex does not access private blockchain information.",
  },
  {
    heading: "Feedback",
    body: "WHAT: feedback type, optional short note, source name, claim/lead id, result host, app version, status. WHY: judge whether results help testers. WHERE: var/beta/state.json. RETENTION: DATA_RETENTION.md. WHO: you and operators. Notes that look like seed material are rejected.",
  },
  {
    heading: "Email / outbox",
    body: "WHAT: verification, password reset, and hunt-notification mail (recipient, subject, body/link, timestamp). WHY: operate the account and optional hunt alerts. WHERE: var/beta/outbox.jsonl and, if configured, an external MailProvider. RETENTION: DATA_RETENTION.md. WHO: operators and the mail provider if one is configured. Terms acceptance is not marketing consent. Poolindex does not send promotional mail in this Beta.",
  },
  {
    heading: "Admin actions",
    body: "WHAT: invite creation, user status/plan/role patches, kill-switch changes, feedback status, hunt stops, deletion processing. WHY: run a closed test. WHERE: state.json plus security.jsonl. WHO: admin-role operators listed in POOLINDEX_ADMIN_EMAILS.",
  },
  {
    heading: "International hosting and APIs",
    body: "The operator host for this preview is the machine running Poolindex (this Cloud/preview environment is ephemeral; durable copies may live on the operator's Linux backup host). Third-party APIs (GitHub, Internet Archive/Wayback, public Ethereum/Arbitrum RPC, and similar) may process query URLs, repository searches, or public addresses outside that location. LEGAL REVIEW REQUIRED for transfer/legal-basis analysis. See PROCESSORS.md.",
  },
  {
    heading: "Your requests",
    body: `You may request account closure, a copy of your account record, a correction, or a privacy question from the account page or by emailing ${contactLine("privacy")}. Closure is request-plus-operator-process in this Beta so security logs are not silently destroyed. User A cannot request deletion of User B.`,
  },
  {
    heading: "Changes",
    body: "If collection practices change, we publish a new Privacy version. You may be asked to accept it before continuing.",
  },
];

export const ACCESSIBILITY_SECTIONS: LegalSection[] = [
  {
    heading: "Commitment",
    body: "Poolindex is being developed with WCAG 2.1 AA accessibility criteria as an engineering target, and with awareness of applicable Israeli web-accessibility expectations. This statement is not a certification and does not claim that Poolindex is fully compliant with WCAG AA or any statute.",
  },
  {
    heading: "What we test",
    body: "Main Closed Beta flows: register, login, password reset, Terms/Privacy, Index, Live scan, Deep Hunt, hunt/lead results, URL Safety Check, wallet check, feedback, and Admin. We look for keyboard use, visible focus, labels, text status (not color alone), page language, and titles.",
  },
  {
    heading: "Known limitations",
    body: "Closed Beta UI is still changing. Some dense tables and third-party dialogs may be harder with a screen reader. Deep Hunt progress updates are summarized rather than announced on every tick to avoid flooding assistive technology. Generated marketing images are decorative when used outside the app. OWNER: expand this list as testers report issues.",
  },
  {
    heading: "Contact",
    body: `Report an accessibility problem to ${contactLine("accessibility")}. Last reviewed: ${LEGAL_UPDATED_DATE}. Version ${ACCESSIBILITY_VERSION}.`,
  },
];

export function needsLegalReacceptance(user: { termsVersion: string; privacyVersion: string } | null | undefined): boolean {
  if (!user) return false;
  return user.termsVersion !== TERMS_VERSION || user.privacyVersion !== PRIVACY_VERSION;
}
