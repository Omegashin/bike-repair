#!/usr/bin/env bash
# PostToolUse (Edit|Write): format the edited file, then typecheck so errors surface immediately.
f=$(jq -r '.tool_input.file_path // empty')
[ -z "$f" ] && exit 0
cd "$CLAUDE_PROJECT_DIR" || exit 0

node_modules/.bin/prettier --write --ignore-unknown "$f" >/dev/null 2>&1

case "$f" in *.ts|*.tsx) ;; *) exit 0 ;; esac
if ! out=$(node_modules/.bin/tsc -b 2>&1); then
  echo "Typecheck failed after editing $f:" >&2
  echo "$out" | head -40 >&2
  exit 2
fi
exit 0
