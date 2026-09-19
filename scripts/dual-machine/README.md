# Dual-machine workload and backup

Claim Scout has two operator machines:

- **Windows PC** — control and interactive development.
- **claimscoutserver (Linux)** — independent compute, runtime, and durable backup (`~/claimscout`).

Do not run `next build`, live scans, and extra agents on both machines at the same time. Check resources first:

```bash
scripts/dual-machine/check-resources.sh
scripts/dual-machine/assign-workload.sh scan
```

On Windows: `scripts/dual-machine/windows/Check-Resources.ps1`

## Backup (append-only)

Snapshots go to `~/claimscout-backups/snapshots/<UTC>/` (Windows: `%USERPROFILE%\claimscout-backups`). `current` is only a symlink. A delete or shrink on one machine cannot rewrite the other machine's older snapshots.

```bash
scripts/dual-machine/snapshot.sh
scripts/dual-machine/verify.sh --all
scripts/dual-machine/install-linux-timer.sh   # 30-minute timer
```

Windows: `New-Snapshot.ps1`, then `Install-BackupTask.ps1`. After OpenSSH is configured, `Send-Snapshot.ps1` copies a **new** folder into Linux `incoming/`; Linux `receive-snapshot.sh` promotes it. There is no `rsync --delete` onto the live tree.

Excluded: `node_modules`, `.next`, `.git` objects (git stays on origin + working copy), `.env` secrets, keys. Included: source, `.env.example`, `logs/`, `var/results/`, config examples.

Restore extracts beside the live tree. `--replace-live` still refuses if the snapshot is older than the working copy, and always snapshots live first.
