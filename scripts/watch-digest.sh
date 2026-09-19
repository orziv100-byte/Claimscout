#!/usr/bin/env bash
# Daily catalog remaining-pool watch. Light, sequential, no retry loop.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
root="$(cd "$here/.." && pwd)"
. "$here/dual-machine/lib.sh"
load_config

if ! resources_ok; then
  echo "watch-digest: SKIP resources not safe"
  exit 2
fi

if [[ -f "$HEAVY_LOCK" ]]; then
  echo "watch-digest: SKIP heavy lock present — wait for the next daily run"
  exit 3
fi

health="$(curl -sf -m 2 http://127.0.0.1:43147/api/health || true)"
if [[ -n "$health" ]]; then
  heavy="$(python3 -c 'import json,sys; print(json.loads(sys.argv[1]).get("resource",{}).get("heavyJobs",0))' "$health")"
  if [[ "$heavy" != "0" ]]; then
    echo "watch-digest: SKIP app already has a heavy job — wait for the next daily run"
    exit 3
  fi
  echo "watch-digest: refreshing via local app"
  curl -sf -m 60 "http://127.0.0.1:43147/api/watch?refresh=1" | python3 -c 'import json,sys; d=json.load(sys.stdin); print(d.get("digest") or d.get("error") or "watch ok")'
  exit 0
fi

cd "$root"
echo "watch-digest: app not listening; running local digest"
NODE_OPTIONS='--max-old-space-size=2048' node --experimental-strip-types --experimental-default-type=module "$here/watch-digest.ts"
