#!/usr/bin/env bash
# Shared helpers for Poolindex dual-machine backup and workload gating.
set -euo pipefail

dual_machine_dir() {
  cd "$(dirname "${BASH_SOURCE[1]}")"
  pwd
}

repo_root_from_scripts() {
  local here
  here="$(cd "$(dirname "${BASH_SOURCE[1]}")" && pwd)"
  cd "$here/../.."
  pwd
}

load_config() {
  local scripts_dir root
  scripts_dir="$(cd "$(dirname "${BASH_SOURCE[1]}")" && pwd)"
  root="$(cd "$scripts_dir/../.." && pwd)"

  local saved_role="${POOLINDEX_ROLE-}"
  local saved_root="${POOLINDEX_ROOT-}"
  local saved_backup="${POOLINDEX_BACKUP_ROOT-}"
  local saved_keep="${POOLINDEX_KEEP_SNAPSHOTS-}"
  local saved_min="${POOLINDEX_MIN_SNAPSHOTS-}"
  local saved_shrink="${POOLINDEX_SHRINK_LIMIT-}"
  local saved_ram="${POOLINDEX_MIN_RAM_MB-}"
  local saved_load="${POOLINDEX_MAX_LOAD_PER_CPU-}"
  local saved_disk="${POOLINDEX_MAX_DISK_PCT-}"

  local cfg="${scripts_dir}/config.env"
  if [[ -f "$cfg" ]]; then
    # shellcheck disable=SC1090
    set -a
    # Do not source secrets files from the app tree.
    source "$cfg"
    set +a
  fi

  [[ -n "$saved_role" ]] && POOLINDEX_ROLE="$saved_role"
  [[ -n "$saved_root" ]] && POOLINDEX_ROOT="$saved_root"
  [[ -n "$saved_backup" ]] && POOLINDEX_BACKUP_ROOT="$saved_backup"
  [[ -n "$saved_keep" ]] && POOLINDEX_KEEP_SNAPSHOTS="$saved_keep"
  [[ -n "$saved_min" ]] && POOLINDEX_MIN_SNAPSHOTS="$saved_min"
  [[ -n "$saved_shrink" ]] && POOLINDEX_SHRINK_LIMIT="$saved_shrink"
  [[ -n "$saved_ram" ]] && POOLINDEX_MIN_RAM_MB="$saved_ram"
  [[ -n "$saved_load" ]] && POOLINDEX_MAX_LOAD_PER_CPU="$saved_load"
  [[ -n "$saved_disk" ]] && POOLINDEX_MAX_DISK_PCT="$saved_disk"

  POOLINDEX_ROLE="${POOLINDEX_ROLE:-linux}"
  POOLINDEX_ROOT="${POOLINDEX_ROOT:-$root}"
  if [[ -z "${POOLINDEX_BACKUP_ROOT:-}" ]]; then
    POOLINDEX_BACKUP_ROOT="${HOME}/poolindex-backups"
  fi
  POOLINDEX_PEER_HOST="${POOLINDEX_PEER_HOST:-}"
  POOLINDEX_PEER_USER="${POOLINDEX_PEER_USER:-}"
  POOLINDEX_PEER_PATH="${POOLINDEX_PEER_PATH:-}"
  POOLINDEX_KEEP_SNAPSHOTS="${POOLINDEX_KEEP_SNAPSHOTS:-14}"
  POOLINDEX_MIN_SNAPSHOTS="${POOLINDEX_MIN_SNAPSHOTS:-3}"
  POOLINDEX_SHRINK_LIMIT="${POOLINDEX_SHRINK_LIMIT:-0.5}"
  POOLINDEX_MIN_RAM_MB="${POOLINDEX_MIN_RAM_MB:-3072}"
  POOLINDEX_MAX_LOAD_PER_CPU="${POOLINDEX_MAX_LOAD_PER_CPU:-1.75}"
  POOLINDEX_MAX_DISK_PCT="${POOLINDEX_MAX_DISK_PCT:-88}"

  POOLINDEX_ROOT="$(cd "${POOLINDEX_ROOT}" && pwd)"
  mkdir -p "${POOLINDEX_BACKUP_ROOT}"
  POOLINDEX_BACKUP_ROOT="$(cd "${POOLINDEX_BACKUP_ROOT}" && pwd)"
  EXCLUDE_FILE="${scripts_dir}/exclude.txt"
  SNAPSHOTS_DIR="${POOLINDEX_BACKUP_ROOT}/snapshots"
  INCOMING_DIR="${POOLINDEX_BACKUP_ROOT}/incoming"
  CURRENT_LINK="${POOLINDEX_BACKUP_ROOT}/current"
  LOCK_FILE="${POOLINDEX_BACKUP_ROOT}/backup.lock"
  HEAVY_LOCK="${TMPDIR:-/tmp}/poolindex-heavy.lock"
  mkdir -p "$SNAPSHOTS_DIR" "$INCOMING_DIR"
}

json_escape() {
  python3 -c 'import json,sys; print(json.dumps(sys.stdin.read()[:-1] if False else sys.argv[1]))' "$1"
}

read_mem_available_mb() {
  if [[ -r /proc/meminfo ]]; then
    awk '/MemAvailable:/ {printf "%d", $2/1024}' /proc/meminfo
    return
  fi
  python3 - <<'PY'
import os
print(int(os.sysconf("SC_PAGE_SIZE") * os.sysconf("SC_AVPHYS_PAGES") / 1024 / 1024))
PY
}

read_ram_used_pct() {
  if [[ -r /proc/meminfo ]]; then
    awk '/MemTotal:/ {t=$2} /MemAvailable:/ {a=$2} END { if (t>0) printf "%.1f", (1-a/t)*100; else print 0 }' /proc/meminfo
    return
  fi
  echo 0
}

read_load1() {
  awk '{print $1}' /proc/loadavg 2>/dev/null || echo 0
}

read_ncpu() {
  nproc 2>/dev/null || echo 1
}

read_disk_used_pct() {
  df -P "$1" | awk 'NR==2 {gsub("%","",$5); print $5}'
}

resource_report() {
  local avail usedpct load ncpu disk
  avail="$(read_mem_available_mb)"
  usedpct="$(read_ram_used_pct)"
  load="$(read_load1)"
  ncpu="$(read_ncpu)"
  disk="$(read_disk_used_pct "${POOLINDEX_ROOT:-/}")"
  printf 'ram_available_mb=%s ram_used_pct=%s load1=%s ncpu=%s disk_used_pct=%s\n' \
    "$avail" "$usedpct" "$load" "$ncpu" "$disk"
}

resources_ok() {
  local avail load ncpu disk load_limit
  avail="$(read_mem_available_mb)"
  load="$(read_load1)"
  ncpu="$(read_ncpu)"
  disk="$(read_disk_used_pct "${POOLINDEX_ROOT:-/}")"
  load_limit="$(python3 -c "print($ncpu * $POOLINDEX_MAX_LOAD_PER_CPU)")"

  if (( avail < POOLINDEX_MIN_RAM_MB )); then
    echo "REFUSE: RAM available ${avail}MB < ${POOLINDEX_MIN_RAM_MB}MB"
    return 1
  fi
  if python3 -c "import sys; sys.exit(0 if float('$load') > float('$load_limit') else 1)"; then
    echo "REFUSE: load ${load} > ${load_limit} (${ncpu} CPUs)"
    return 1
  fi
  if python3 -c "import sys; sys.exit(0 if float('$disk') >= float('$POOLINDEX_MAX_DISK_PCT') else 1)"; then
    echo "REFUSE: disk ${disk}% >= ${POOLINDEX_MAX_DISK_PCT}%"
    return 1
  fi
  echo "OK: RAM ${avail}MB available, load ${load}/${ncpu}, disk ${disk}%"
  return 0
}

with_backup_lock() {
  python3 - "$LOCK_FILE" <<'PY'
import os, sys, time, fcntl
path = sys.argv[1]
fd = os.open(path, os.O_CREAT | os.O_RDWR, 0o644)
fcntl.flock(fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
os.write(fd, f"{os.getpid()} {time.time()}\n".encode())
print(fd)
PY
}

tar_excludes_args() {
  local args=()
  if [[ -f "$EXCLUDE_FILE" ]]; then
    while IFS= read -r line || [[ -n "$line" ]]; do
      [[ -z "$line" || "$line" == \#* ]] && continue
      args+=(--exclude="./$line")
    done < "$EXCLUDE_FILE"
  fi
  printf '%s\n' "${args[@]}"
}

count_source_files() {
  (
    cd "$POOLINDEX_ROOT"
    local excludes=()
    if [[ -f "$EXCLUDE_FILE" ]]; then
      while IFS= read -r line || [[ -n "$line" ]]; do
        [[ -z "$line" || "$line" == \#* ]] && continue
        excludes+=(-o -path "./$line" -prune)
      done < "$EXCLUDE_FILE"
    fi
    # find: skip excluded paths then print files
    find . \( -false "${excludes[@]}" \) -o -type f -print 2>/dev/null | wc -l
  )
}

source_newest_unix() {
  (
    cd "$POOLINDEX_ROOT"
    find . -type f \
      ! -path './node_modules/*' ! -path './.next/*' ! -path './.git/*' \
      -printf '%T@\n' 2>/dev/null | sort -nr | head -n 1 | cut -d. -f1
  )
  true
}

latest_snapshot_dir() {
  ls -1d "$SNAPSHOTS_DIR"/20* 2>/dev/null | sort | tail -n 1 || true
}

write_manifest() {
  python3 - "$@" <<'PY'
import json, os, sys, time
dest, source, role, sha, bytes_, file_count, newest, git_head, git_branch, git_status = sys.argv[1:11]
manifest = {
  "schema": 1,
  "created_unix": int(time.time()),
  "created_utc": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
  "hostname": os.uname().nodename,
  "role": role,
  "source_root": source,
  "git_head": git_head,
  "git_branch": git_branch,
  "git_status": git_status,
  "source_newest_unix": int(newest or 0),
  "file_count": int(file_count),
  "archive_bytes": int(bytes_),
  "archive_sha256": sha,
  "verified": False,
}
open(os.path.join(dest, "MANIFEST.json"), "w").write(json.dumps(manifest, indent=2) + "\n")
PY
}

mark_verified() {
  python3 - "$1" <<'PY'
import json, sys
path = sys.argv[1] + "/MANIFEST.json"
data = json.load(open(path))
data["verified"] = True
open(path, "w").write(json.dumps(data, indent=2) + "\n")
PY
}

read_manifest_field() {
  python3 - "$1" "$2" <<'PY'
import json, sys
data = json.load(open(sys.argv[1] + "/MANIFEST.json"))
print(data.get(sys.argv[2], ""))
PY
}
