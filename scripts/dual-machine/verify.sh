#!/usr/bin/env bash
# Verify snapshot archives. Default: current symlink, or all snapshots with --all.
set -euo pipefail
. "$(cd "$(dirname "$0")" && pwd)/lib.sh"
load_config

ALL=0
TARGET=""
for arg in "$@"; do
  case "$arg" in
    --all) ALL=1 ;;
    --help|-h) echo "Usage: $0 [--all] [snapshot-dir]"; exit 0 ;;
    *) TARGET="$arg" ;;
  esac
done

verify_one() {
  local dir="$1"
  if [[ ! -f "${dir}/tree.tar.gz" || ! -f "${dir}/tree.tar.gz.sha256" ]]; then
    echo "FAIL $dir (missing archive or checksum)"
    return 1
  fi
  if ! ( cd "$dir" && sha256sum -c tree.tar.gz.sha256 >/dev/null ); then
    echo "FAIL $dir (sha256 mismatch — leaving files in place, not deleting)"
    return 1
  fi
  if [[ -f "${dir}/repo.bundle.sha256" ]]; then
    if ! ( cd "$dir" && sha256sum -c repo.bundle.sha256 >/dev/null ); then
      echo "FAIL $dir (git bundle checksum mismatch)"
      return 1
    fi
  fi
  local count
  count="$(tar -tzf "${dir}/tree.tar.gz" | wc -l | tr -d ' ')"
  echo "OK $dir files=${count}"
}

fail=0
if [[ "$ALL" -eq 1 ]]; then
  shopt -s nullglob
  for dir in "$SNAPSHOTS_DIR"/20*; do
    verify_one "$dir" || fail=1
  done
elif [[ -n "$TARGET" ]]; then
  verify_one "$TARGET" || fail=1
else
  if [[ ! -e "$CURRENT_LINK" ]]; then
    echo "FAIL: no current snapshot at $CURRENT_LINK"
    exit 1
  fi
  verify_one "$(readlink -f "$CURRENT_LINK")" || fail=1
fi
exit "$fail"
