# Bike Repair Tracker

Repair ticket tracker for a small bike shop. See [decisions.md](decisions.md) for scope and design, and [CLAUDE.md](CLAUDE.md) for the rules AI-assisted changes follow.

## Run it

Requires Docker.

```sh
docker compose up --build
```

Open http://localhost:8080. The database is migrated and seeded with demo data on first start.
Ports are configurable with `APP_PORT` and `DB_PORT` (defaults 8080 and 5433).

## Demo data

The seed ([seed.ts](apps/api/prisma/seed.ts)) creates 7 tickets covering every status, with promised-by dates relative to today so some are always overdue. Browse them with `npm run db:studio` (needs `npm run db:up`).

## Develop

Requires Node 24+ and Docker (for Postgres).

```sh
cp .env.example .env
npm install
npm run db:up      # Postgres only
npm run db:seed    # demo data
npm run dev:api    # http://localhost:3000/api/health
npm run dev:web    # http://localhost:5173 (proxies /api to the API)
```

## Test

```sh
npm run check      # typecheck, lint, formatting, unit and API tests (needs `npm run db:up`)
npm run test:e2e   # Playwright, desktop and mobile (first time: npx playwright install chromium)
```

## AI-assisted development

This repo was built with Claude Code inside a small harness, so AI-written code is held to the same checks as mine:

- [CLAUDE.md](CLAUDE.md): the project's rules for the agent: invariants from the decision document, where code goes, and the commands to verify work.
- [.claude/hooks/](.claude/hooks/): after every edit, the file is formatted and typechecked; edits to existing migrations, generated code and `.env` files are blocked; and the agent can't finish a turn while `npm run check` fails.
- Business rules were specified as tests first ([status.test.ts](packages/shared/src/status.test.ts)), so the agent implemented against my spec rather than writing its own.

## Dependency notes

Two blocks in the root `package.json` aren't self-explanatory:

- `overrides` replaces two vulnerable packages that Prisma 7.10 pins internally (`mysql2`, which this Postgres app never loads, and `deepmerge-ts`) with patched versions, so `npm audit` is clean. Remove it once a Prisma 7.x release includes the fixes.
- `allowScripts` declines three dependency install scripts that npm 12+ asks about. None is needed: Prisma downloads its migration engine on first use, and `fsevents` ships prebuilt.
