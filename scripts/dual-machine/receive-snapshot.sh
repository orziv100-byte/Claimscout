#!/usr/bin/env bash
# Promote incoming snapshot directories into append-only snapshots/.
# Never extracts into the live working copy. Never overwrites an existing stamp.
set -euo pipefail
. "$(cd "$(dirname "$0")" && pwd)/lib.sh"
load_config

shopt -s nullglob
incoming=("$INCOMING_DIR"/20*)
if [[ ${#incoming[@]} -eq 0 ]]; then
  echo "receive: nothing in $INCOMING_DIR"
  exit 0
fi

promoted=0
for dir in "${incoming[@]}"; do
  name="$(basename "$dir")"
  dest="${SNAPSHOTS_DIR}/${name}"
  if [[ -e "$dest" ]]; then
    dest="${SNAPSHOTS_DIR}/${name}-recv-$$"
    echo "receive: stamp $name already exists; keeping both as $dest"
  fi
  if [[ ! -f "${dir}/tree.tar.gz.sha256" ]]; then
    echo "receive: skip $dir (no checksum — possible incomplete copy)"
    continue
  fi
  if ! ( cd "$dir" && sha256sum -c tree.tar.gz.sha256 >/dev/null ); then
    echo "receive: skip $dir (checksum failed — leaving incoming in place)"
    continue
  fi
  mv "$dir" "$dest"
  mark_verified "$dest"
  ln -sfn "$dest" "$CURRENT_LINK"
  echo "receive: promoted $dest"
  promoted=$((promoted + 1))
done

echo "receive: promoted ${promoted} snapshot(s)"
