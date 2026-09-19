# Restore procedure

© 2026 Claim Scout. All rights reserved.

This Cloud VM is ephemeral. Durable backups live on **claimscoutserver** (`~/claimscout-backups`) and any copies kept on the Windows control PC.

## Verify a snapshot

```bash
bash scripts/dual-machine/verify.sh --all
bash scripts/dual-machine/verify.sh /path/to/snapshots/STAMP
```

A verified snapshot has `MANIFEST.json` with `"verified": true`, matching `tree.tar.gz.sha256`, and (if present) `repo.bundle.sha256`.

## Restore beside the live tree (default, safe)

```bash
bash scripts/dual-machine/restore.sh --from=STAMP
```

Extracts to `~/claimscout-backups/restores/restore-<utc>`. The live working copy is not modified.

## Restore when replacing a damaged live tree

1. Confirm the host is stable (`bash scripts/dual-machine/check-resources.sh`).
2. `bash scripts/dual-machine/restore.sh --from=STAMP --replace-live`
3. That command snapshots live first, then extracts to a **sibling** directory. It does not overwrite live.
4. Compare sibling vs live. Only rename/swap after you confirm the restored tree is the one you want.
5. Copy `var/beta/` and `var/results/` from the restored tree if you need accounts and watch history.
6. Restart `npm run start` or `npm run dev` **once**. Do not loop restarts.

Older snapshots are refused when live is newer (`restore.sh` exit 4).

## Git bundle

Snapshots taken with `--with-git` include `repo.bundle`. Restore history with:

```bash
git clone repo.bundle restored-repo
```

Git origin is not a substitute for timestamped snapshots.

## Closed Beta data

Account, invite, session, telemetry, and feedback files live in `var/beta/` (gitignored). Include that directory in snapshot restore or testers will need to re-register.

## Pre-Beta snapshot for this work

- Stamp: `20260919T193714Z`
- Git: `cursor/resource-safety-guards-415b` `1adec459b9`
- SHA-256 `tree.tar.gz`: `ca1f2020bf19709870083003916cf9b1913b4284ea2dd12647368f7ed58b66cb`
