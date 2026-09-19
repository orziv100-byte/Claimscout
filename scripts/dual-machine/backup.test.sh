#!/usr/bin/env bash
# Isolated tests for append-only backup guards. Does not touch the live tree
# except reading scripts. Uses a temp directory.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
tmp="$(mktemp -d /tmp/claimscout-backup-test.XXXXXX)"
trap 'rm -rf "$tmp"' EXIT

mkdir -p "$tmp/project/app" "$tmp/project/logs" "$tmp/backups"
printf 'hello\n' > "$tmp/project/app/page.txt"
printf 'log\n' > "$tmp/project/logs/run.log"
printf 'SECRET=1\n' > "$tmp/project/.env"
mkdir -p "$tmp/project/node_modules/x"
printf 'nope\n' > "$tmp/project/node_modules/x/mod.js"
cp "$here/exclude.txt" "$tmp/exclude.txt"
# Use the real scripts with env overrides.
export CLAIM_SCOUT_ROOT="$tmp/project"
export CLAIM_SCOUT_BACKUP_ROOT="$tmp/backups"
export CLAIM_SCOUT_ROLE="test"
export CLAIM_SCOUT_KEEP_SNAPSHOTS=3
export CLAIM_SCOUT_MIN_SNAPSHOTS=2
export CLAIM_SCOUT_SHRINK_LIMIT=0.5
export CLAIM_SCOUT_MIN_RAM_MB=1
export CLAIM_SCOUT_MAX_LOAD_PER_CPU=100
export CLAIM_SCOUT_MAX_DISK_PCT=99

echo "TEST snapshot 1"
"$here/snapshot.sh"
test -f "$tmp/backups/current/tree.tar.gz"
( cd "$tmp/backups/current" && sha256sum -c tree.tar.gz.sha256 )
# Secrets and node_modules must not be inside the archive.
if tar -tzf "$tmp/backups/current/tree.tar.gz" | grep -E '(^\./\.env$|node_modules)'; then
  echo "FAIL: excluded path leaked into archive"
  exit 1
fi
tar -tzf "$tmp/backups/current/tree.tar.gz" | grep -q './app/page.txt'
echo "PASS snapshot excludes secrets/caches"

echo "TEST verify"
"$here/verify.sh"
echo "PASS verify"

echo "TEST shrink guard"
rm -rf "$tmp/project/app" "$tmp/project/logs"
printf 'tiny\n' > "$tmp/project/only.txt"
if "$here/snapshot.sh"; then
  echo "FAIL: shrink guard should have aborted"
  exit 1
fi
# Previous snapshot must still verify.
"$here/verify.sh"
echo "PASS shrink guard left previous snapshot intact"

echo "TEST restore does not clobber live"
stamp="$(basename "$(readlink -f "$tmp/backups/current")")"
"$here/restore.sh" --from="$stamp"
# live tiny tree still there
test -f "$tmp/project/only.txt"
echo "PASS restore extracted beside live tree"

echo "TEST older-live replace refused"
# Recreate a richer live tree that is newer than the snapshot contents.
mkdir -p "$tmp/project/app"
printf 'newer-live\n' > "$tmp/project/app/page.txt"
sleep 1
printf 'newer-live-2\n' > "$tmp/project/app/page.txt"
if "$here/restore.sh" --from="$stamp" --replace-live; then
  echo "FAIL: should refuse to replace newer live copy"
  exit 1
fi
grep -q newer-live "$tmp/project/app/page.txt"
echo "PASS refuse overwrite of newer live copy"

echo "TEST assign-workload backup allowed"
"$here/assign-workload.sh" backup

echo "ALL TESTS PASSED"
