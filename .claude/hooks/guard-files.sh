#!/usr/bin/env bash
# PreToolUse (Edit|Write): block edits to applied migrations and env files.
f=$(jq -r '.tool_input.file_path // empty')
[ -z "$f" ] && exit 0
case "$f" in
  */prisma/migrations/*)
    echo "Blocked: existing Prisma migrations are immutable. Change schema.prisma and run 'npm run db:migrate -- --name <change>' to create a new migration." >&2
    exit 2 ;;
  */src/generated/prisma/*)
    echo "Blocked: the Prisma client is generated. Edit apps/api/prisma/schema.prisma and run 'npm run db:migrate -- --name <change>', which regenerates it." >&2
    exit 2 ;;
esac
case "$(basename "$f")" in
  .env.example) exit 0 ;;
  .env|.env.*)
    echo "Blocked: .env files hold secrets and are edited by the human. Update .env.example instead and say what value is needed." >&2
    exit 2 ;;
esac
exit 0
