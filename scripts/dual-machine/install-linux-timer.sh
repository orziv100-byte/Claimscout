#!/usr/bin/env bash
# Install a 30-minute snapshot+verify timer on Linux. Idempotent.
# Uses systemd --user when available, otherwise crontab.
set -euo pipefail
. "$(cd "$(dirname "$0")" && pwd)/lib.sh"
load_config

here="$(cd "$(dirname "$0")" && pwd)"
unit_dir="${HOME}/.config/systemd/user"
service="${unit_dir}/poolindex-backup.service"
timer="${unit_dir}/poolindex-backup.timer"

if command -v systemctl >/dev/null 2>&1 && systemctl --user status >/dev/null 2>&1; then
  mkdir -p "$unit_dir"
  cat > "$service" <<EOF
[Unit]
Description=Poolindex append-only backup snapshot

[Service]
Type=oneshot
Nice=10
IOSchedulingClass=idle
Environment=POOLINDEX_ROOT=${POOLINDEX_ROOT}
Environment=POOLINDEX_BACKUP_ROOT=${POOLINDEX_BACKUP_ROOT}
ExecStart=${here}/snapshot.sh
ExecStartPost=${here}/verify.sh
EOF
  cat > "$timer" <<EOF
[Unit]
Description=Poolindex backup every 30 minutes

[Timer]
OnBootSec=5min
OnUnitActiveSec=30min
Persistent=true
Unit=poolindex-backup.service

[Install]
WantedBy=timers.target
EOF
  systemctl --user daemon-reload
  systemctl --user enable --now poolindex-backup.timer
  echo "install: systemd user timer poolindex-backup.timer enabled"
  exit 0
fi

cron_line="*/30 * * * * POOLINDEX_ROOT=${POOLINDEX_ROOT} POOLINDEX_BACKUP_ROOT=${POOLINDEX_BACKUP_ROOT} ${here}/snapshot.sh >/tmp/poolindex-backup.log 2>&1 && ${here}/verify.sh >>/tmp/poolindex-backup.log 2>&1"
tmp="$(mktemp)"
crontab -l 2>/dev/null | grep -v 'poolindex-backup\|dual-machine/snapshot.sh' > "$tmp" || true
echo "$cron_line" >> "$tmp"
crontab "$tmp"
rm -f "$tmp"
echo "install: crontab line installed (every 30 minutes)"
