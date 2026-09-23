#!/usr/bin/env bash
# Install a once-daily catalog watch timer on Linux. Idempotent. Does not retry failed runs.
set -euo pipefail
. "$(cd "$(dirname "$0")" && pwd)/lib.sh"
load_config

here="$(cd "$(dirname "$0")" && pwd)"
root="$(cd "$here/../.." && pwd)"
digest="${root}/scripts/watch-digest.sh"
unit_dir="${HOME}/.config/systemd/user"
service="${unit_dir}/poolindex-watch.service"
timer="${unit_dir}/poolindex-watch.timer"

if command -v systemctl >/dev/null 2>&1 && systemctl --user status >/dev/null 2>&1; then
  mkdir -p "$unit_dir"
  cat > "$service" <<EOF
[Unit]
Description=Poolindex daily catalog watch digest

[Service]
Type=oneshot
Nice=10
IOSchedulingClass=idle
Environment=POOLINDEX_ROOT=${POOLINDEX_ROOT}
ExecStart=${digest}
# Exit 2/3 are deliberate SKIP outcomes (resources unsafe, heavy lock, upstream
# source unavailable) — not failures. Only an unhandled crash (any other
# non-zero code) should show this unit as failed.
SuccessExitStatus=2 3
EOF
  cat > "$timer" <<EOF
[Unit]
Description=Poolindex catalog watch once a day

[Timer]
OnCalendar=*-*-* 06:00:00
Persistent=true
RandomizedDelaySec=300
Unit=poolindex-watch.service

[Install]
WantedBy=timers.target
EOF
  systemctl --user daemon-reload
  systemctl --user enable --now poolindex-watch.timer
  echo "install: systemd user timer poolindex-watch.timer enabled (06:00 UTC ±5min)"
  exit 0
fi

cron_line="0 6 * * * ${digest} >/tmp/poolindex-watch.log 2>&1"
tmp="$(mktemp)"
crontab -l 2>/dev/null | grep -v 'poolindex-watch\|watch-digest.sh' > "$tmp" || true
echo "$cron_line" >> "$tmp"
crontab "$tmp"
rm -f "$tmp"
echo "install: crontab line installed (06:00 daily, no retry loop)"
