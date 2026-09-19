#!/usr/bin/env bash
# Live dual-machine verification. Prints PASS/FAIL from commands, not plans.
set -u
here="$(cd "$(dirname "$0")" && pwd)"
. "$here/lib.sh"
load_config

echo "=== dual-machine live verify $(date -u +%FT%TZ) host=$(hostname) user=$(whoami) ==="
echo "role=${POOLINDEX_ROLE:-unset} root=${POOLINDEX_ROOT}"

echo
echo "--- resources ---"
resource_report
if resources_ok; then
  echo "RESOURCES: PASS"
else
  echo "RESOURCES: FAIL"
fi

echo
echo "--- local backup ---"
if [[ -x "$here/verify.sh" ]] && POOLINDEX_BACKUP_ROOT="${POOLINDEX_BACKUP_ROOT:-$HOME/poolindex-backups}" "$here/verify.sh" --all; then
  echo "LOCAL_BACKUP_VERIFY: PASS"
else
  echo "LOCAL_BACKUP_VERIFY: FAIL (no verified snapshots on this host)"
fi

echo
echo "--- SSH to claimed Linux server ---"
ssh_ok=0
for spec in \
  "lior@10.100.102.71" \
  "lior@poolindexserver.local" \
  "lior@poolindexserver"
 do
  echo "try ssh -o BatchMode=yes -o ConnectTimeout=4 $spec"
  if ssh -o BatchMode=yes -o ConnectTimeout=4 -o StrictHostKeyChecking=no "$spec" "echo SERVER_SSH_OK \$(hostname) \$(whoami)" 2>&1 | tee /tmp/ssh_try.out | grep -q SERVER_SSH_OK; then
    ssh_ok=1
    break
  fi
done
if [[ "$ssh_ok" -eq 1 ]]; then
  echo "SERVER_SSH: PASS"
else
  echo "SERVER_SSH: FAIL"
fi

echo
echo "--- workload lock ---"
if [[ -f "${HEAVY_LOCK:-/tmp/poolindex-heavy.lock}" ]]; then
  echo "WORKLOAD_LOCK: occupied $(cat "$HEAVY_LOCK")"
else
  echo "WORKLOAD_LOCK: free"
fi
"$here/assign-workload.sh" backup || true

echo
echo "MAIN_PC: FAIL unless this host is the Windows control PC (hostname=$(hostname))"
echo "SERVER: see SERVER_SSH above; Cursor worker connectivity is reported by the parent agent MCP, not this script"
echo "BACKUP: see LOCAL_BACKUP_VERIFY; automatic-on-both-machines requires this script to PASS on Windows AND on poolindexserver"
echo "WORKLOAD_DISTRIBUTION: FAIL unless SERVER_SSH PASS and a second host ran assign-workload concurrently"
