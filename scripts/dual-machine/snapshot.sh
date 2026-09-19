#!/usr/bin/env bash
# Create an append-only versioned snapshot of the Poolindex working copy.
# Never overwrites an existing snapshot directory. Never copies secrets or
# reproducible caches. Refuses to record a suddenly-shrunken tree.
set -euo pipefail
. "$(cd "$(dirname "$0")" && pwd)/lib.sh"
load_config

ALLOW_SHRINK=0
WITH_GIT=0
for arg in "$@"; do
  case "$arg" in
    --allow-shrink) ALLOW_SHRINK=1 ;;
    --with-git) WITH_GIT=1 ;;
    --help|-h)
      echo "Usage: $0 [--allow-shrink] [--with-git]"
      exit 0
      ;;
  esac
done

if ! resources_ok; then
  echo "snapshot: refusing because this machine is under resource pressure."
  exit 2
fi

exec 9>"$LOCK_FILE"
if ! flock -n 9; then
  echo "snapshot: another backup is already running. Not stacking jobs."
  exit 3
fi

stamp="$(date -u +%Y%m%dT%H%M%SZ)"
dest="${SNAPSHOTS_DIR}/${stamp}"
if [[ -e "$dest" ]]; then
  dest="${SNAPSHOTS_DIR}/${stamp}-$$"
fi
prev="$(latest_snapshot_dir)"
mkdir -p "$dest"

mapfile -t tar_excludes < <(tar_excludes_args)
git_head="untracked"
git_branch="unknown"
git_status=""
if [[ -d "${POOLINDEX_ROOT}/.git" ]]; then
  git_head="$(git -C "$POOLINDEX_ROOT" rev-parse HEAD 2>/dev/null || echo untracked)"
  git_branch="$(git -C "$POOLINDEX_ROOT" rev-parse --abbrev-ref HEAD 2>/dev/null || echo unknown)"
  git_status="$(git -C "$POOLINDEX_ROOT" status -sb 2>/dev/null | tr '\n' ';')"
fi

if [[ ${#tar_excludes[@]} -gt 0 ]]; then
  tar -C "$POOLINDEX_ROOT" "${tar_excludes[@]}" -cf - . | gzip -1 > "${dest}/tree.tar.gz"
else
  tar -C "$POOLINDEX_ROOT" -cf - . | gzip -1 > "${dest}/tree.tar.gz"
fi
file_count="$(tar -tzf "${dest}/tree.tar.gz" | wc -l | tr -d ' ')"
newest="$(source_newest_unix || echo 0)"
[[ -z "$newest" ]] && newest=0
bytes="$(stat -c%s "${dest}/tree.tar.gz")"
sha="$(sha256sum "${dest}/tree.tar.gz" | awk '{print $1}')"
printf '%s  tree.tar.gz\n' "$sha" > "${dest}/tree.tar.gz.sha256"

if [[ "$WITH_GIT" -eq 1 && -d "${POOLINDEX_ROOT}/.git" ]]; then
  git -C "$POOLINDEX_ROOT" bundle create "${dest}/repo.bundle" --all >/dev/null
  sha256sum "${dest}/repo.bundle" | awk '{print $1 "  repo.bundle"}' > "${dest}/repo.bundle.sha256"
fi

printf '%s\n' "$git_head" > "${dest}/GIT-HEAD"
printf '%s\n' "$git_branch" > "${dest}/GIT-BRANCH"

write_manifest "$dest" "$POOLINDEX_ROOT" "$POOLINDEX_ROLE" "$sha" "$bytes" "$file_count" "$newest" "$git_head" "$git_branch" "$git_status"

# Shrink / deletion guard against the previous verified snapshot.
if [[ -n "$prev" && "$prev" != "$dest" && -f "${prev}/MANIFEST.json" && "$ALLOW_SHRINK" -eq 0 ]]; then
  prev_count="$(read_manifest_field "$prev" file_count || echo 0)"
  if [[ -n "$prev_count" && "$prev_count" != "0" ]]; then
    too_small="$(python3 -c "print(int($file_count) < int($prev_count) * float('$POOLINDEX_SHRINK_LIMIT'))")"
    if [[ "$too_small" == "True" ]]; then
      echo "snapshot: ABORT file_count ${file_count} is below ${POOLINDEX_SHRINK_LIMIT} of previous ${prev_count}."
      echo "snapshot: previous snapshot left intact at $prev"
      rm -rf "$dest"
      exit 4
    fi
  fi
fi

( cd "$dest" && sha256sum -c tree.tar.gz.sha256 >/dev/null )
mark_verified "$dest"

# current is a symlink only. Previous snapshots stay on disk.
ln -sfn "$dest" "$CURRENT_LINK"

# Retention: drop oldest verified snapshots only when more than KEEP and MIN remain.
mapfile -t all < <(ls -1d "$SNAPSHOTS_DIR"/20* 2>/dev/null | sort)
total="${#all[@]}"
keep="$POOLINDEX_KEEP_SNAPSHOTS"
min="$POOLINDEX_MIN_SNAPSHOTS"
if (( total > keep && total > min )); then
  drop=$(( total - keep ))
  if (( total - drop < min )); then
    drop=$(( total - min ))
  fi
  i=0
  while (( i < drop )); do
    victim="${all[$i]}"
    # Never delete the snapshot we just made or the current target.
    if [[ "$victim" == "$dest" ]]; then
      i=$((i + 1))
      continue
    fi
    echo "snapshot: pruning old snapshot $victim"
    rm -rf "$victim"
    i=$((i + 1))
  done
fi

echo "snapshot: wrote $dest"
echo "snapshot: files=${file_count} bytes=${bytes} sha256=${sha}"
echo "snapshot: git=${git_branch} ${git_head}"
