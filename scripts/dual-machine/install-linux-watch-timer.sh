#!/usr/bin/env bash
# Install a once-daily catalog watch timer on Linux. Idempotent. Does not retry failed runs.
set -euo pipefail
. "$(cd "$(dirname "$0")" && pwd)/lib.sh"
load_config

here="$(cd "$(dirname "$0")" && pwd)"
root="$(cd "$here/../.." && pwd)"
digest="${root}/scripts/watch-digest.sh"
unit_dir="${HOME}/.config/systemd/user"
service="${unit_dir}/claimscout-watch.service"
timer="${unit_dir}/claimscout-watch.timer"

if command -v systemctl >/dev/null 2>&1 && systemctl --user status >/dev/null 2>&1; then
  mkdir -p "$unit_dir"
  cat > "$service" <<EOF
[Unit]
Description=Claim Scout daily catalog watch digest

[Service]
Type=oneshot
Nice=10
IOSchedulingClass=idle
Environment=CLAIM_SCOUT_ROOT=${CLAIM_SCOUT_ROOT}
ExecStart=${digest}
EOF
  cat > "$timer" <<EOF
[Unit]
Description=Claim Scout catalog watch once a day

[Timer]
OnCalendar=*-*-* 06:00:00
Persistent=true
RandomizedDelaySec=300
Unit=claimscout-watch.service

[Install]
WantedBy=timers.target
EOF
  systemctl --user daemon-reload
  systemctl --user enable --now claimscout-watch.timer
  echo "install: systemd user timer claimscout-watch.timer enabled (06:00 UTC ±5min)"
  exit 0
fi

cron_line="0 6 * * * ${digest} >/tmp/claimscout-watch.log 2>&1"
tmp="$(mktemp)"
crontab -l 2>/dev/null | grep -v 'claimscout-watch\|watch-digest.sh' > "$tmp" || true
echo "$cron_line" >> "$tmp"
crontab "$tmp"
rm -f "$tmp"
echo "install: crontab line installed (06:00 daily, no retry loop)"
