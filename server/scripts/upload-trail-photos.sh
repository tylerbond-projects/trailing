#!/usr/bin/env bash
# Uploads scripts/photos/out/*.jpg to the R2 bucket. Usage: scripts/upload-trail-photos.sh [--local|--remote]
set -euo pipefail
MODE="${1:---remote}"
cd "$(dirname "$0")/.."
n=0
for f in scripts/photos/out/*.jpg; do
  key=$(basename "$f")
  npx wrangler r2 object put "trailing-photos/$key" --file "$f" --content-type image/jpeg --cache-control "public, max-age=31536000, immutable" "$MODE" >/dev/null
  n=$((n+1))
done
echo "uploaded $n files ($MODE)"
