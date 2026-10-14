#!/usr/bin/env bash
# Stop: don't let a turn end with a red `npm run check`.
# Gives up after 3 consecutive blocks per session so a stuck agent can hand back to the human.
input=$(cat)
session=$(echo "$input" | jq -r '.session_id // "unknown"')
cd "$CLAUDE_PROJECT_DIR" || exit 0

# Nothing changed since the last commit → nothing to verify.
[ -z "$(git status --porcelain 2>/dev/null)" ] && exit 0

counter="${TMPDIR:-/tmp}/bike-repair-check-$session"
if out=$(npm run check 2>&1); then
  rm -f "$counter"
  exit 0
fi

n=$(( $(cat "$counter" 2>/dev/null || echo 0) + 1 ))
echo "$n" > "$counter"
if [ "$n" -gt 3 ]; then
  rm -f "$counter"
  echo '{"systemMessage": "npm run check is still failing after 3 attempts — stopping so you can take a look."}'
  exit 0
fi

echo "npm run check failed (attempt $n/3). Fix it before finishing, or explain to the user why you can't:" >&2
echo "$out" | tail -60 >&2
exit 2
