# PoolIndex legal audit (pre-implementation snapshot + follow-up)

This audit describes the Closed Beta codebase **before** this hardening pass, then notes what engineering work was added. It is **not** legal advice and **not** a certification of compliance with any law.

Date: 2026-09-20. App version: 0.1.0.

## Classification key

PASS / PARTIAL / MISSING / INCONSISTENT / NEEDS OWNER/LAWYER CONFIRMATION

## Findings (pre-pass)

| Area | Status | Notes |
| --- | --- | --- |
| Copyright / owner notice | PASS | `© 2026 Lior Elbaz, Israel. All rights reserved.` in LICENSE, COPYRIGHT.md, footer, README, package.json, Terms. Does not claim third-party code. |
| Third-party notices | PARTIAL | Direct packages listed without versions, licenses, notice/redistribution columns, or transitive production tree. |
| Terms of Use | PARTIAL | Short Beta terms: research-only, no guarantees, public addresses, acceptable use, planned Pro. Missing operator identification placeholders, age, crypto/gas/irreversible txs, account closure, warranty/liability, governing law placeholder, Deep Hunt, feedback license, version/effective date completeness. |
| Privacy Notice | PARTIAL | Collects email, wallets, telemetry, logs. Did not inventory Deep Hunt files, IP on login, outbox, hunt leads, or access/correction/deletion requests. |
| Wallet wording | INCONSISTENT | UI/safety said “session storage only”; server stores `user.wallets` for plan limits. Privacy already described server storage. |
| Consent records | PASS | Server stores user ID, Terms version, Privacy version, timestamp. Registration rejected without both checkboxes. |
| Re-acceptance on version change | MISSING | Versions stored but no prompt when documents change. |
| Account deletion | MISSING | No user request, no admin queue. Disable exists for operators only. |
| Privacy rights contact | MISSING | “Beta operator contact” only. No configurable privacy@ address. |
| Retention policy | MISSING | Privacy said “while Beta running” without categories. |
| Processors inventory | MISSING | GitHub, Wayback, archive.org, public RPC, optional mail not documented as processors. |
| International transfers | MISSING | No factual hosting/API location note. |
| Deep Hunt / Continuous Hunt privacy | PARTIAL | Product exists; Privacy/Terms did not describe hunt files or public-wallet research. |
| Lead vs eligibility wording | PARTIAL | Lead cards had eligibility unknown / Safe to review; needed explicit “not money owed”. |
| Crypto warning before external claim links | MISSING | Official UI links opened without an independent-verification warning. |
| Accessibility statement | MISSING | No page. Some labels and focus styles exist; no skip link; hunt progress not in a live region. |
| WCAG AA claim | PASS (correctly absent) | Product did not claim certified WCAG AA. Keep it that way. |
| Security disclosure | MISSING | No SECURITY.md / reporting contact. |
| Absolute safety claims | PARTIAL | “Safe to review” used; safety page said a pass is not a guarantee. Needed consistency on third-party sites. |
| Pro purchase implication | PASS | Upgrade copy already says payment processing unavailable / planned. |
| Contact configuration | MISSING | No env keys for support/privacy/security/accessibility/legal. |
| Legal versioning UI | PARTIAL | Version strings exist; effective/last-updated dates incomplete. |
| Governing law / age / database registration | NEEDS OWNER/LAWYER CONFIRMATION | Not inventable. |
| Marketing consent | PASS | No marketing emails. Hunt notifications are operational. |

## Follow-up engineering (this pass)

Implemented documentation, wallet-wording alignment, Terms/Privacy expansion, deletion request workflow, configurable contact placeholders, accessibility statement, skip link, hunt textual live region (without elapsed-time flooding), crypto warning at official claim links, third-party license table, retention/processors/security/paid-launch docs, legal readiness reporter (production contact/claim blockers), and tests. Remaining OWNER/LEGAL items stay marked in those documents. This is not a legal certification.
