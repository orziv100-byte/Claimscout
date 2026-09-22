#!/usr/bin/env bash
# Extract a snapshot to a temp dir and compare JSON user/wallet counts to live.
# Never --replace-live. Never writes onto ~/claimscout.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
root="$(cd "$here/.." && pwd)"
. "$here/dual-machine/lib.sh"
load_config

FROM="${1:-}"
if [[ -z "$FROM" ]]; then
  FROM="$(latest_snapshot_dir)"
fi
if [[ -z "$FROM" || ! -d "$FROM" ]]; then
  echo "restore-drill: no snapshot"
  exit 1
fi

out="${POOLINDEX_BACKUP_ROOT}/restores/drill-$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -p "$out"
tar -xzf "${FROM}/tree.tar.gz" -C "$out"
echo "restore-drill: extracted $FROM -> $out"

python3 - <<PY
import json, os, sys
live = os.path.join("$root", "var/beta/state.json")
# snapshot tar layout is the project root
cands = []
for dirpath, _, files in os.walk("$out"):
    if "state.json" in files and dirpath.endswith("var/beta"):
        cands.append(os.path.join(dirpath, "state.json"))
restored = cands[0] if cands else ""
def counts(path):
    if not os.path.exists(path):
        return None
    s = json.load(open(path))
    users = s.get("users") or []
    return {
        "users": len(users),
        "wallets": sum(len(u.get("wallets") or []) for u in users),
        "sessions": len(s.get("sessions") or []),
    }
a = counts(live)
b = counts(restored)
print("live", a)
print("restored", b)
print("restored_state", restored)
if not a or not b:
    sys.exit(2)
# Drill proves the snapshot opens. Counts may differ if live moved after snapshot.
print("restore-drill: OK opened state.json (live tree untouched)")
PY
echo "restore-drill: live tree still at $root"
