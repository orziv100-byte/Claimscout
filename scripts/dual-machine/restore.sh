#!/usr/bin/env bash
# Restore a snapshot into a NEW directory. Never writes onto the live tree
# unless --replace-live is given AND a fresh snapshot of live just succeeded.
set -euo pipefail
. "$(cd "$(dirname "$0")" && pwd)/lib.sh"
load_config

REPLACE_LIVE=0
FROM=""
for arg in "$@"; do
  case "$arg" in
    --replace-live) REPLACE_LIVE=1 ;;
    --from=*) FROM="${arg#--from=}" ;;
    --help|-h)
      echo "Usage: $0 --from=SNAPSHOT_DIR_OR_STAMP [--replace-live]"
      exit 0
      ;;
  esac
done

if [[ -z "$FROM" ]]; then
  echo "restore: required --from=TIMESTAMP or path"
  exit 1
fi

if [[ -d "$FROM" ]]; then
  src="$FROM"
elif [[ -d "${SNAPSHOTS_DIR}/${FROM}" ]]; then
  src="${SNAPSHOTS_DIR}/${FROM}"
else
  echo "restore: cannot find snapshot $FROM"
  exit 1
fi

if ! "$(cd "$(dirname "$0")" && pwd)/verify.sh" "$src"; then
  echo "restore: refusing damaged snapshot"
  exit 1
fi

src_newest="$(read_manifest_field "$src" source_newest_unix || echo 0)"
live_newest="$(source_newest_unix || echo 0)"
if [[ "$REPLACE_LIVE" -eq 1 && -n "$live_newest" && -n "$src_newest" ]]; then
  if python3 -c "import sys; sys.exit(0 if int('$src_newest' or 0) < int('$live_newest' or 0) else 1)"; then
    echo "restore: snapshot source_newest ${src_newest} is older than live ${live_newest}."
    echo "restore: refusing to overwrite a newer valid working copy."
    exit 4
  fi
fi

out="${CLAIM_SCOUT_BACKUP_ROOT}/restores/restore-$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -p "$out"
tar -xzf "${src}/tree.tar.gz" -C "$out"
echo "restore: extracted to $out (live tree untouched)"

if [[ "$REPLACE_LIVE" -eq 1 ]]; then
  echo "restore: taking a safety snapshot of the live tree first"
  "$(cd "$(dirname "$0")" && pwd)/snapshot.sh"
  # Copy into a sibling folder next to live, not over it. Operator can rename.
  sibling="${CLAIM_SCOUT_ROOT}.restored-$(date -u +%Y%m%dT%H%M%SZ)"
  mkdir -p "$sibling"
  tar -xzf "${src}/tree.tar.gz" -C "$sibling"
  echo "restore: live tree still at ${CLAIM_SCOUT_ROOT}"
  echo "restore: restored copy at ${sibling}"
  echo "restore: replace live yourself only after comparing the two trees."
fi
