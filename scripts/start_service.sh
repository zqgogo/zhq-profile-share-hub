#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

cd "$ROOT_DIR"

if [[ $# -ge 1 && -n "${1:-}" ]]; then
  export PUBLIC_BASE_URL="$1"
fi

echo "Starting profile-share-hub in $ROOT_DIR"
if [[ -n "${PUBLIC_BASE_URL:-}" ]]; then
  echo "Using PUBLIC_BASE_URL=$PUBLIC_BASE_URL"
fi

npm start
