#!/usr/bin/env sh
# Checkpoint explicitly named files; do not scoop up secrets or unrelated work.
set -eu
if [ "$#" -lt 2 ]; then
  echo 'Usage: scripts/checkpoint.sh "commit message" path [path ...]' >&2
  exit 2
fi
message=$1
shift
git add -- "$@"
git diff --cached --check
git commit -m "$message"
