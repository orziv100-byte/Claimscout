#!/usr/bin/env bash
# Daily per-wallet engine monitor. Sequential, no retry loop. Separate from catalog watch.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
root="$(cd "$here/.." && pwd)"
. "$here/dual-machine/lib.sh"
load_config

if ! resources_ok; then
  echo "engine-digest: SKIP resources not safe"
  exit 2
fi

if [[ -f "$HEAVY_LOCK" ]]; then
  echo "engine-digest: SKIP heavy lock present — wait for the next daily run"
  exit 3
fi

health="$(curl -sf -m 2 http://127.0.0.1:43147/api/health || true)"
if [[ -n "$health" ]]; then
  heavy="$(python3 -c 'import json,sys; print(json.loads(sys.argv[1]).get("resource",{}).get("heavyJobs",0))' "$health")"
  if [[ "$heavy" != "0" ]]; then
    echo "engine-digest: SKIP app already has a heavy job — wait for the next daily run"
    exit 3
  fi
fi

cd "$root"
echo "engine-digest: running wallet monitor"
NODE_OPTIONS='--max-old-space-size=2048' node --import tsx "$here/engine-digest.ts"
