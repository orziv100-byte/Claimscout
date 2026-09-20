# Poolindex data retention (product policy)

This is a **product policy** for Closed Beta file stores under `var/beta/`. It is **not** a statement of statutory retention. LEGAL REQUIREMENT TO CONFIRM / OWNER/LAWYER DECISION REQUIRED before treating these periods as legal obligations.

| Category | What | Product policy | Legal requirement |
| --- | --- | --- | --- |
| Account records | email, password hash, display name, plan, wallets, consent versions | Keep while the account is open. After processed closure: identifiers removed; user id retained as `deleted-{id}` mailbox for log correlation. | OWNER/LAWYER DECISION REQUIRED |
| Sessions | session id, user id, expiry | Expire (~7 days) or revoke on logout/disable/closure. | None asserted |
| Verify/reset tokens | hash, expiry | Unused tokens expire (verify 24h; reset per auth module). Used tokens kept until expiry. | None asserted |
| Security logs | login success/failure (may include IP), admin actions, deletion events | Keep for Beta operations and abuse review. Do not use as advertising data. | LEGAL REQUIREMENT TO CONFIRM |
| Telemetry | scan/hunt resource events, truncated query, user id | Keep for Beta quality. Not advertising. | OWNER DECISION REQUIRED |
| Scan jsonl | per-user scan rows | Keep with the account; not deleted automatically on request (operator may purge after closure). | OWNER DECISION REQUIRED |
| Feedback | type, note, source, lead id | Keep for Beta review. | OWNER DECISION REQUIRED |
| Deep Hunt / leads | `var/beta/hunts/{userId}/` | Persist until closure processing; files are user-scoped. Operator may retain a copy in backups. | OWNER DECISION REQUIRED |
| Email/outbox | recipient, subject, body/link | Keep to debug delivery. | OWNER DECISION REQUIRED |
| Backups | dual-machine snapshots | Append-only snapshots may contain older copies after live deletion. Restore must not silently undelete a closed account into production without operator review. | OWNER DECISION REQUIRED |
| Rate-limit IP counters | in-memory | Ephemeral; not a stored profile. | None asserted |

Do not invent a statutory period (tax, AML, or consumer law) here.
