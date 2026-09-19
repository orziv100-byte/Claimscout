#!/usr/bin/env bash
# Print CPU/RAM/disk and exit 0 only if heavy work is allowed.
set -euo pipefail
. "$(cd "$(dirname "$0")" && pwd)/lib.sh"
load_config
resource_report
resources_ok
