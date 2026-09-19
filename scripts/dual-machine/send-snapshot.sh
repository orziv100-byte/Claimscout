#!/usr/bin/env bash
# Copy the latest verified snapshot to the Linux peer as a NEW incoming folder.
# Never rsync --delete into a live working copy.
set -euo pipefail
. "$(cd "$(dirname "$0")" && pwd)/lib.sh"
load_config

if [[ -z "$POOLINDEX_PEER_HOST" ]]; then
  echo "send: POOLINDEX_PEER_HOST is empty."
  echo "send: git remains the control-plane sync. Configure SSH in config.env to push snapshot tarballs."
  exit 1
fi

if ! resources_ok; then
  echo "send: refusing under resource pressure"
  exit 2
fi

current="$(readlink -f "$CURRENT_LINK" 2>/dev/null || true)"
if [[ -z "$current" || ! -d "$current" ]]; then
  echo "send: no current snapshot; run snapshot.sh first"
  exit 1
fi
"$(cd "$(dirname "$0")" && pwd)/verify.sh" "$current"

remote_user="${POOLINDEX_PEER_USER:-}"
remote="${POOLINDEX_PEER_HOST}"
[[ -n "$remote_user" ]] && remote="${remote_user}@${remote}"
remote_path="${POOLINDEX_PEER_PATH:-~/poolindex-backups/incoming}"
name="$(basename "$current")"

echo "send: $current -> ${remote}:${remote_path}/${name}"
ssh -o BatchMode=yes "$remote" "mkdir -p ${remote_path}"
scp -o BatchMode=yes -r "$current" "${remote}:${remote_path}/${name}"
echo "send: done. On the peer run receive-snapshot.sh (it only promotes verified incoming dirs)."
