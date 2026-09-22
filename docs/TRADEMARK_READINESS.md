# PoolIndex trademark readiness

This file is an **engineering evidence pack** for the product/brand name **PoolIndex**. It is **not** legal advice, **not** a trademark search, and **not** a conclusion that the mark is available in any country.

**Copyright of original source code is not trademark registration and does not prove exclusive ownership of the PoolIndex name.** Software changes cannot establish trademark registration.

- The registered-mark symbol is **not** used in the product.
- The product does **not** state that PoolIndex is a registered trademark.
- Trademark clearance and registration: **LEGAL REVIEW REQUIRED**.

## Brand identity (factual)

| Item | Recorded fact |
| --- | --- |
| Exact mark | PoolIndex |
| Styling in code | `BRAND_NAME` / `BRAND_WORD_MARK` = `PoolIndex` (`lib/app-info.ts`) |
| Previous display styling (2026-09-19 to 2026-09-20) | `Poolindex` (capital P only), after rebrand commit `e33931fcb8` |
| Former product names (git history) | Claimscout, Claim Scout |
| Word mark vs logo mark | Current UI uses a **text word mark** in the site header (heading font). No separate registered logo file is committed. Untracked local PNG drafts exist under `public/poolindex-google-business-logo.png` and `public/poolindex-google-business-cover.png` (dated 2026-09-20 on disk; **not in git** as of this audit). |
| Registration claimed in product | No (`BRAND_REGISTRATION_CLAIMED = false`) |

## Product category and description

PoolIndex is a Closed Beta **research / discovery / safety-check** web tool. It helps invited testers search, organize, and review **publicly described** cryptocurrency claims, airdrops, faucets, giveaways, archived offers, and similar public sources, and run read-only checks against **public wallet addresses**. It is not a wallet, exchange, broker, custodian, claims processor, or payment processor.

Intended commercial services (planned, **not billed** in this Beta): a Free research scan and a planned **PoolIndex Pro** paid plan (target $20/month or $99/year; payment processing unavailable). **LEGAL REVIEW REQUIRED** for Nice/class selection and service descriptions used in any filing.

## Software / service categories (for counsel — not a filing)

Possible discussion points for a trademark lawyer only (not a chosen class list):

- Downloadable or hosted software for searching and organizing public blockchain-related offer information
- Software as a service for research and URL safety checks
- Providing information about publicly described crypto claims (research tool, not financial advice)

Do **not** treat this list as a Nice Classification filing.

## Countries / markets planned for launch

- Operator identified in product copy: Lior Elbaz, **Israel**.
- Closed Beta tester locations: **UNKNOWN / OWNER CONFIRMATION REQUIRED**.
- No committed list of launch countries exists in this repository.
- **LEGAL REVIEW REQUIRED** before selecting filing jurisdictions.

## Domains used or planned

| Record | Status |
| --- | --- |
| Contact placeholders `*@POOLINDEX_DOMAIN` | Configuration required; not a registered domain in this repo |
| Local preview | `http://127.0.0.1:43147` (README) |
| Dual-machine hostname in scripts | `poolindexserver` / `poolindexserver.local` (ops hostname, not a public brand domain) |
| Git remote path | `.../lior100-lior/claim-scout.git` (forge repository path) |
| Public production domain | **UNKNOWN** — OWNER CONFIRMATION REQUIRED |

Do not invent a production domain.

## First documented project use (from this repository only)

Do **not** treat git dates as first commercial use.

| Date (commit author/committer dates in this clone) | Evidence | Notes |
| --- | --- | --- |
| 2026-09-11 | `6f2cea3b05` Initialize project | Earliest commit in this clone |
| 2026-09-11 | `18a130b79d` Add Claimscout public crypto claim discovery app | First named-product commit (former name) |
| 2026-09-11 | `b0257c2fd8` Allow the Preview iframe to load Claimscout | Internal Cursor Preview iframe; **not** recorded as public commercial use |
| 2026-09-19 | `e33931fcb8` Rebrand the product to Poolindex across UI, env, and ops | **First documented use of the Poolindex/PoolIndex product name in this repository** |
| 2026-09-20 | `344f4f2e11` Record Poolindex copyright as Lior Elbaz, Israel | Copyright owner attribution |
| 2026-09-20 | `d6b1d9f431` / `ec03507267` Legal, privacy, accessibility hardening | Legal documents still used display form Poolindex until this trademark pass |
| App version | `0.1.0` in `package.json` / `APP_VERSION` | Dated release tags: **none found** in this clone |

## First public / commercial use

**UNKNOWN** unless the owner later attaches independent evidence (live public URL, invoices, ads, App Store listing, press). This repository documents local/preview development and a Closed Beta that is invite-only. Git history and Cursor Preview are **not** treated here as proven first public commercial use.

## Evidence to preserve (do not destroy)

Keep these so counsel can reconstruct development/use history:

- Git history (including former Claim Scout / Claimscout commits — do not rewrite history to hide the former name)
- Dated commits and Closed Beta document versions (`beta-2026-09-20.3` after this pass)
- Product version `0.1.0`
- Documentation under `docs/`, `README.md`, `LICENSE`, `COPYRIGHT.md`
- Dual-machine append-only snapshots (`scripts/dual-machine/`) if they contain dated trees
- Local/untracked dated marketing drafts (Google Business PNG files on disk 2026-09-20) **if** the owner wants them as specimens — copy them into a lawyer folder; they are not committed here
- Domain registrar records **when a public domain is actually purchased** (not in this repo)

## Former branding audit (Claim Scout / ClaimScout / Claimscout)

Audit date: 2026-09-20. Current `HEAD` working tree (this branch) was searched for `Claim Scout`, `ClaimScout`, `Claimscout`, `claim-scout`, `claimscout`, and `Scout+`.

**No remaining user-facing product-name matches in the current source tree.** Former names remain in **git history**, which must be kept.

| Occurrence | Classification |
| --- | --- |
| Git commits such as `18a130b79d`, `b0257c2fd8`, `669974ff7e`, `43d925e1e3`, older `Claimscout.exe` / Windows pack commits | **HISTORICAL RECORD — KEEP** |
| Forge repository path `claim-scout.git` | **INTERNAL INFRASTRUCTURE — OPTIONAL** (do not rename automatically; remotes and existing clones would break) |
| systemd units `poolindex-backup.service` / `poolindex-watch.timer` (already PoolIndex-era names) | Keep; **do not rename** without an ops plan |
| Windows scheduled task default name `Poolindex-Backup` | **INTERNAL INFRASTRUCTURE — OPTIONAL** |
| Env vars `POOLINDEX_*`, npm name `poolindex`, session key `poolindex.address` | **INTERNAL INFRASTRUCTURE — OPTIONAL** (identifiers, not the brand display) |
| Catalog / safety references to third-party hosts such as `claim.ens.domains` | **THIRD-PARTY / REFERENCE — KEEP** |
| Current UI, Terms, Privacy, README, header word mark | Already renamed; **MUST RENAME** items were completed in `e33931fcb8` (Claim Scout → Poolindex) and this pass (display form Poolindex → **PoolIndex**) |

No automatic rename of the git remote, systemd units, or Windows task names is performed.

## Known naming conflicts from previous screening

**Not documented in this repository.** No USPTO, Israel Patent Office, or WIPO search memo is committed. If the operator has search printouts from the former Claim Scout screening or from a PoolIndex screening, attach those files to the lawyer package. Chat or agent memory is not a filing record.

Do **not** conclude that PoolIndex is globally available.

## TRADEMARK REGISTRATION — OWNER/LAWYER ACTION REQUIRED

1. Software edits, copyright notices, and this markdown file **cannot** register a trademark.
2. Only the owner (or counsel) can search, file, prosecute, and maintain a mark in each desired jurisdiction.
3. Until a registration actually exists **in the relevant jurisdiction**, do not use a registered-mark symbol and do not tell users that PoolIndex is a registered trademark.
4. A TM legend is **not** sprinkled across the UI in this pass (owner may add it later after counsel advice).
5. Filing strategy (word mark vs logo, classes, countries, first-use dates) is **LEGAL REVIEW REQUIRED**.

## Factual package for a trademark lawyer

Give counsel this file plus the git repository.

- **Exact mark:** PoolIndex
- **Form:** word mark (text). Logo mark: uncommitted PNG drafts only, unless owner later adopts a locked logo
- **Owner of copyright in code (not automatically the trademark owner of record):** Lior Elbaz, Israel — **OWNER/LAWYER** to confirm who should be the trademark applicant
- **Description of the product:** Closed Beta research tool for public crypto claim sources; read-only public-address checks; Deep Hunt over public sources
- **Intended commercial services:** planned PoolIndex Pro subscription/license (not billed yet)
- **Intended markets:** Israel (operator); other countries UNKNOWN
- **Documented development evidence:** git from 2026-09-11; PoolIndex name from 2026-09-19 (`e33931fcb8`); version 0.1.0
- **Domain information:** no public brand domain recorded; placeholders only
- **Former names:** Claimscout / Claim Scout (historical)
- **Known conflicts documented in-repo:** none
- **Final clearance and registration:** **LEGAL REVIEW REQUIRED**
