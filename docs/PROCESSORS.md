# PoolIndex processors (actual integrations)

This lists services the running application may contact. It does **not** invent unused vendors. LEGAL REVIEW REQUIRED for transfer analysis.

| Integration | Purpose | Information that may be sent | Auth | Wallet/query/IP |
| --- | --- | --- | --- | --- |
| Operator host / this preview VM | Runs PoolIndex, file store `var/beta/` | All account, hunt, log, and outbox data | Operator access | Stored locally |
| Dual-machine backup host (Linux `~/poolindex-backups` when used) | Append-only snapshots | Source tree, logs, `var/results`; snapshots should exclude `.env` and secrets | Operator | May include prior `var/` if misconfigured — operators must keep secrets out |
| GitHub Search API | Live/Deep Hunt source (plan-gated) | Search query text | Optional `GITHUB_TOKEN` | Query text; no private keys |
| Wayback Machine CDX | Archive lookup | URL/host being inspected | None | URL |
| Internet Archive | Archive.org search | Query text | None | Query |
| Public Ethereum RPC (`ETH_RPC_URL` or default public node) | Read-only `eth_call` / balances | Public contract and wallet addresses | None typically | Public address |
| Public Arbitrum RPC (`ARB_RPC_URL` or default) | Same, Arbitrum catalog checks | Public address / contract | None typically | Public address |
| Injected browser wallet | Optional connect (`eth_requestAccounts`) | Public address in the browser | User wallet | Address only; PoolIndex does not send seeds |
| MailProvider / outbox file | Verify email, password reset, hunt notices | Recipient email, subject, body/link | Local fallback `var/beta/outbox.jsonl` | Email, not wallet keys |
| Resend (when `POOLINDEX_MAIL_PROVIDER=resend`) | Deliver verify/reset/operational mail from `poolindex.app` | Recipient, subject, body/link | `RESEND_API_KEY` in gitignored env | Email, not wallet keys |
| Reddit / Bitcointalk HTTP | Reserved/plan-gated live sources | Search query | None | Query; not enabled as Free default |

Not used in this Closed Beta: payment processors, analytics SDKs, advertising pixels, customer-support SaaS (unless the operator later configures mail).

Hosting location: the process runs where the operator starts it (this Cloud preview is ephemeral). Third-party APIs above may process requests in other countries. LEGAL REVIEW REQUIRED.
