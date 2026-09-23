#!/usr/bin/env bash
# On-demand operator check: recent login-failure bursts and service health.
# Read-only. Does not modify anything, does not run continuously, does not
# email/alert anyone by itself — an operator (or a future cron) runs this.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
root="$(cd "$here/.." && pwd)"
security_log="${POOLINDEX_BETA_DIR:-${root}/var/beta}/security.jsonl"
window_minutes="${1:-60}"
burst_threshold=5
echo "=== login_failure bursts in the last ${window_minutes} minutes (threshold: ${burst_threshold}) ==="
if [[ -f "$security_log" ]]; then
  cutoff="$(date -u -d "-${window_minutes} minutes" +%Y-%m-%dT%H:%M:%S 2>/dev/null || date -u -v-${window_minutes}M +%Y-%m-%dT%H:%M:%S)"
  bursts="$(
    awk -v cutoff="$cutoff" -v threshold="$burst_threshold" '
      /"type":"login_failure"/ {
        match($0, /"at":"([^"]+)"/, at)
        match($0, /"email":"([^"]+)"/, em)
        if (at[1] >= cutoff && em[1] != "") count[em[1]]++
      }
      END { for (e in count) if (count[e] >= threshold) print count[e], e }
    ' "$security_log" | sort -rn
  )"
  if [[ -z "$bursts" ]]; then
    echo "  (none above threshold)"
  else
    printf '%s\n' "$bursts"
  fi
else
  echo "  no security log found at $security_log"
fi
echo
echo "=== service health ==="
for unit in claimscout.service poolindex-watch.service poolindex-internal-admin.service; do
  if systemctl --user is-failed "$unit" >/dev/null 2>&1; then
    echo "  FAILED: $unit"
  else
    echo "  ok: $unit"
  fi
done
