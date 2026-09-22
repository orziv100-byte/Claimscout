#!/usr/bin/env bash
# Install a once-daily wallet engine monitor timer on Linux. Idempotent. Does not retry failed runs.
# Runs at 07:00 so it does not stack with catalog watch at 06:00.
set -euo pipefail
. "$(cd "$(dirname "$0")" && pwd)/lib.sh"
load_config

here="$(cd "$(dirname "$0")" && pwd)"
root="$(cd "$here/../.." && pwd)"
digest="${root}/scripts/engine-digest.sh"
unit_dir="${HOME}/.config/systemd/user"
service="${unit_dir}/poolindex-engine.service"
timer="${unit_dir}/poolindex-engine.timer"

if command -v systemctl >/dev/null 2>&1 && systemctl --user status >/dev/null 2>&1; then
  mkdir -p "$unit_dir"
  cat > "$service" <<EOF
[Unit]
Description=PoolIndex daily wallet engine monitor

[Service]
Type=oneshot
Nice=10
IOSchedulingClass=idle
Environment=POOLINDEX_ROOT=${POOLINDEX_ROOT}
Environment=NODE_ENV=production
EnvironmentFile=-${root}/.env
ExecStart=${digest}
EOF
  cat > "$timer" <<EOF
[Unit]
Description=PoolIndex wallet engine monitor once a day

[Timer]
OnCalendar=*-*-* 07:00:00
Persistent=true
RandomizedDelaySec=300
Unit=poolindex-engine.service

[Install]
WantedBy=timers.target
EOF
  systemctl --user daemon-reload
  systemctl --user enable --now poolindex-engine.timer
  echo "install: systemd user timer poolindex-engine.timer enabled (07:00 ±5min)"
  exit 0
fi

echo "install: systemd user not available; not installing a retrying cron"
exit 1
