#!/usr/bin/env bash
# Gate a heavy task. Prefer one stable job at a time.
# Usage: assign-workload.sh <dev|build|scan|backup|watch> [--run -- command...]
set -euo pipefail
. "$(cd "$(dirname "$0")" && pwd)/lib.sh"
load_config

task="${1:-}"
shift || true
if [[ -z "$task" ]]; then
  echo "Usage: $0 <dev|build|scan|backup|watch> [--run -- cmd...]"
  exit 1
fi

echo "assign: role=${POOLINDEX_ROLE} host=$(hostname) task=${task}"
resource_report

if [[ -f "$HEAVY_LOCK" ]]; then
  echo "REFUSE: heavy lock exists at $HEAVY_LOCK"
  echo "assign: another heavy job is marked in progress. Do not stack."
  exit 3
fi

if ! resources_ok; then
  echo "assign: move independent work off this machine (Windows=control, Linux=compute/backup)."
  exit 2
fi

case "$task" in
  dev)
    echo "ASSIGN: Windows control machine for interactive dev when possible."
    echo "ASSIGN: Linux may run next only if Windows is overloaded AND no other heavy job is running."
    ;;
  build|scan)
    echo "ASSIGN: Linux server (${POOLINDEX_ROLE}) for $task — independent of the Windows editor."
    echo "ASSIGN: do not also start next build/scan on Windows at the same time."
    ;;
  backup|watch)
    echo "ASSIGN: $task is light; run on the machine that holds the live catalog copy."
    echo "ASSIGN: do not stack with next build or a live scan."
    ;;
  *)
    echo "unknown task $task"
    exit 1
    ;;
esac

if [[ "${1:-}" == "--run" ]]; then
  shift
  [[ "${1:-}" == "--" ]] && shift
  printf '%s %s\n' "$$" "$(date -u +%FT%TZ)" > "$HEAVY_LOCK"
  trap 'rm -f "$HEAVY_LOCK"' EXIT
  "$@"
fi
