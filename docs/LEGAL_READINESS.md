# PoolIndex Closed Beta — legal + privacy + accessibility readiness report

This is an **engineering / legal-documentation readiness** report. It is **not** legal advice, **not** a certification of compliance with any law, and **not** a claim that PoolIndex is WCAG AA certified.

Date: 2026-09-20. App version: 0.1.0. Document versions: Terms / Privacy / Accessibility `beta-2026-09-20.2`. Effective and last updated: 2026-09-20.

Operator attribution in product copy: **Copyright © 2026 Lior Elbaz, Israel. All rights reserved.** No company registration number, VAT number, registered office, phone, or counsel is published because those facts are not confirmed.

## 1. Copyright status

PASS for original PoolIndex code attribution. LICENSE, COPYRIGHT.md, README, package.json, footer, and Terms intellectual-property section name Lior Elbaz, Israel. Original code is distinguished from third-party packages. No Israeli national identity number is published.

## 2. Ownership notices

PASS. Footer, legal pages, and LICENSE forbid copying, sale, distribution, sublicensing, or commercial use without prior written permission from Lior Elbaz. Third-party software remains under its own licenses.

## 3. Third-party license audit

PARTIAL / documented. Direct runtime and development packages are listed in `THIRD_PARTY_NOTICES.md` with version, license, source, and flag columns. Production lockfile walk: no UNKNOWN LICENSE, no GPL/AGPL/MPL copyleft in the production tree. Flags: `caniuse-lite` CC-BY-4.0 ATTRIBUTION REQUIRED; `argparse` Python-2.0 NON-STANDARD. Dependencies were **not** deleted for license flags. OWNER: review CC-BY and Python-2.0 notices before a wider distribution.

## 4. Terms status

PASS as Closed Beta Terms of Use (`beta-2026-09-20.2`) covering operator placeholder, Closed Beta, eligibility/age (LEGAL REVIEW REQUIRED), invites, acceptable/prohibited use, public wallets, Deep Hunt / Continuous Hunt, third-party links, crypto/research limits (no advice, no brokerage, no custody, no execution, no guaranteed eligibility/reward), planned Pro (not purchasable), availability, account closure, IP, feedback, warranty/liability (LEGAL REVIEW REQUIRED), versioning, contacts, governing law placeholder.

## 5. Privacy status

PASS as an inventory of what the running app stores: account, consent, sessions, IP on login security events, hunt files, feedback, outbox, admin actions, hosting/API note. Wallet checks in a desktop build with the local engine stay on the PC. Older desktop builds may send a public address to the host for a check that is not saved as scan history. Deep Hunt remains on the operator host. Not a GDPR/Israeli-privacy certification.

## 6. Wallet disclosure status

PASS (aligned 2026-09-24). UI, Terms, Privacy, and `WALLET_DISCLOSURE` all state: public `0x` only; desktop session storage for the current check; local-engine results stored on that PC; website does not run wallet scans; older desktop builds may still send a public address to the host without saving scan history; Deep Hunt remains on the operator host; never request/store private keys, seed phrases, recovery phrases, or wallet passwords.

## 7. Consent / versioning

PASS. Server stores user ID, Terms version, Privacy version, timestamp. Registration requires both acceptances. Material version change sets `needsLegalReacceptance` and the account banner records a new acceptance. Checkboxes alone are not sufficient.

## 8. Account / data deletion

PASS for Closed Beta request workflow. Authenticated user re-enters password and types DELETE. Request is recorded. User A cannot close User B (password is bound to the target account; API uses the session user id). Admin can process or reject. Completion disables the account, anonymizes email/name, clears wallets, burns the password hash, revokes sessions, and keeps security logs. Immediate silent wipe of audit logs is not implemented.

## 9. Retention policy

PASS as product policy in `docs/DATA_RETENTION.md`. Statutory periods are marked OWNER/LAWYER DECISION REQUIRED. Not invented.

## 10. Processor inventory

PASS for actual integrations in `docs/PROCESSORS.md` (host, optional backup host, GitHub, Wayback, Internet Archive, public RPC, injected wallet, mail/outbox, Resend when configured). No unused vendors invented. Transfer legal basis: LEGAL REVIEW REQUIRED.

## 11. Deep Hunt privacy

PASS in Terms/Privacy. Public wallet + public sources/archives/(planned Pro) public chain research. Continuous Hunt described as periodic incremental research, off unless started, ended with Pause/Stop. No private chain access implied.

## 12. Crypto disclaimers

PASS at Terms plus `EXTERNAL_CLAIM_WARNING` before official third-party claim links, and on-chain dialog copy that PoolIndex does not execute the transaction. Lead cards: research lead, not money owed.

## 13. Security disclosure

PASS as `SECURITY.md` (reporting placeholder, no bounty, no destructive-testing authorization).

## 14. Accessibility audit

PARTIAL. Engineering target: WCAG 2.1 AA. Audited in code: register/login/reset labels, Terms/Privacy/Accessibility pages, skip link, `lang="en"`, page titles, Deep Hunt text status + polite live region without elapsed-time flooding, Pause/Resume/Stop names, lead statuses as text (Investigating / Reviewable / Rejected / Potential risk), header wallet label, Pro planned wording. Not a full independent WCAG audit. Contrast, zoom, and screen-reader sessions still need tester reports.

## 15. Accessibility fixes

Skip link to `#main-content`; legal re-accept region; form error `role="alert"`; Privacy Notice wording; header public-address label; Deep Hunt live region split; Continuous Hunt off-by-default copy; admin closure button names; license-key label.

## 16. Accessibility statement

PASS as `/accessibility` (not a WCAG AA certification). Contact: `accessibility@POOLINDEX_DOMAIN` until configured.

## 17. Contact configuration

PASS as placeholders + env keys `POOLINDEX_CONTACT_*`. Production legal-readiness treats missing real addresses as blockers. Preview may use placeholders.

## 18. Closed Beta disclosures

PASS in header, home, Terms, legal page headers. Features may change; results may be wrong; availability is not guaranteed; feedback is encouraged.

## 19. Future paid-launch requirements

Documented in `docs/PAID_LAUNCH_CHECKLIST.md`. Payment processing is **not** implemented. Pro is marked planned / coming later. Do not sell Pro in this Beta.

## 20. Tests added

`lib/legal-hardening.test.ts` (acceptance versions, re-acceptance, deletion ownership, admin deletion, wallet disclosure, legal pages, contacts, a11y basics, Deep Hunt textual status, Pro planned, legal-gate). `lib/copyright.test.ts` updated for Terms heading/version.

## 21. Full test results

`npm test` on 2026-09-20: **78/78 node tests passed**, dual-machine backup script **ALL TESTS PASSED**. Includes prior security/product tests plus `lib/legal-hardening.test.ts` and updated `lib/copyright.test.ts`.

## 22. Remaining technical blockers

- Real `POOLINDEX_CONTACT_*` addresses must be set before Closed Beta launch (`legalReadiness()` production blockers).
- Operator must replace `POOLINDEX_DOMAIN` placeholders in SECURITY.md display once configured.
- Independent accessibility testing with assistive technology is still outstanding.

## 23. OWNER DECISIONS REQUIRED

- Confirm business name / address if a registered entity must appear.
- Confirm real support, privacy, security, accessibility, and legal mailboxes.
- Confirm whether any tester age rule should be published before invites go to minors.
- Confirm retention periods you actually want for telemetry, hunts, outbox, and backups.
- Review CC-BY `caniuse-lite` and Python-2.0 `argparse` notices.

## 24. LEGAL REVIEW REQUIRED

- Governing law and jurisdiction.
- Minimum user age / capacity.
- Warranty disclaimer and limitation of liability wording under Israeli and tester-location law.
- International transfer / processor legal basis.
- Statutory retention, database-registration, consumer, and crypto-regulatory classification.
- Whether any privacy statute requires additional notices before external testers join.

## 25. Final Closed Beta readiness (technical / legal-documentation only)

**Technically ready to show Closed Beta legal pages, consent records, deletion requests, wallet disclosures, and accessibility statement — once contact env values are configured.**

**Not legally certified. Not WCAG AA certified. Not ready to claim statutory compliance.**
