# Bike Repair Tracker

Repair ticket tracker for a small bike shop. Product decisions and their reasons live in `decisions.md`; read it before changing scope, the data model or the status rules.

## Layout (npm workspaces)

- `apps/web`: React + Vite + Tailwind. Staff queue/intake and the public customer lookup page.
- `apps/api`: Express REST API. `src/app.ts` exports `createApp()` (tests use it); `src/index.ts` only listens. With `WEB_DIST_DIR` set, Express also serves the built frontend (production and Docker).
- `packages/shared`: Zod schemas and business rules, imported by both apps as `@bike-repair/shared`.
- `apps/api/prisma`: Prisma 7 schema, migrations and seed. Client is generated into `apps/api/src/generated/prisma` (gitignored, never edit); import `prisma` from `apps/api/src/db.ts`.
- `e2e/`: Playwright tests (desktop + mobile). Runs its own API on :3100 and web on :5199 against `bike_repair_e2e`.
- `docker-compose.yml`: Postgres (host port 5433) with `bike_repair`, `bike_repair_test`, `bike_repair_e2e`; plus `app`, built by `Dockerfile` exactly as production runs it (one port, no hot reload).

### Where new code goes

Follow this layout; don't invent new top-level folders. Create a folder only when its first file is needed.

```
packages/shared/src/
  status.ts, overdue.ts       business rules
  schemas.ts                  Zod request schemas (intake, status change, lookup)
apps/api/src/
  index.ts                    listen only
  app.ts                      middleware + mounts routers; no route logic
  db.ts                       Prisma client + date helpers
  routes/tickets.ts           staff endpoints (+ tickets.test.ts beside it)
  routes/lookup.ts            public customer lookup (+ lookup.test.ts)
  middleware/                 auth, error handler
apps/web/src/
  main.tsx, App.tsx           entry + page routing
  api.ts                      the only place that calls fetch
  pages/                      one component per screen: QueuePage, IntakePage, TicketPage, LookupPage
  components/                 UI pieces used by more than one page
```

## Commands

- `npm run check`: typecheck + lint + Prettier check + unit and API tests. **Must pass before you say a task is done.** A Stop hook enforces this. API tests need Postgres: if they say it isn't reachable, run `npm run db:up`.
- `npm run format`: Prettier. Edited files are formatted automatically by a hook.
- `npm run test`: Vitest only. `npx vitest run <path>` runs one file.
- `npm run test:e2e`: Playwright. Not part of `check`; run it before finishing any slice that changes UI or a user flow.
- Day-to-day development: `npm run db:up`, then `npm run dev:api` and `npm run dev:web` (hot reload, http://localhost:5173).
- `npm run start`: build and run the production-like app in Docker (http://localhost:8080). Use it to confirm the reviewer's one-command path still works.
- `npm run db:migrate -- --name <change>`: after editing `schema.prisma`, creates and applies a migration and regenerates the client.
- `npm run db:seed`: demo data (skips if tickets exist).
- `npm install <pkg> -w apps/api` (or `-w apps/web`, `-w packages/shared`) adds a dependency to one workspace.

## Invariants (never break)

- Statuses and transitions are defined ONLY in `packages/shared/src/status.ts`. API and UI import them; never copy the table. `status.test.ts` is the spec. Don't edit it to make code pass; if a rule should change, stop and ask.
- A status change updates `Ticket` and writes `TicketEvent` in ONE Prisma transaction. Creating a ticket writes its first event (`fromStatus: null → received`).
- `TicketStatus` in `schema.prisma` must match `STATUSES` (`src/schema.test.ts` checks this).
- Customer lookup returns only status and promised-by date. Never notes, name, phone or history.
- Wrong ticket number and wrong phone digits return the SAME 404 response, so lookups don't reveal which tickets exist.
- Error contract: `400` with Zod field errors · `409` for a disallowed transition (body includes allowed next statuses) · `401` for staff endpoints without a session.
- Overdue = the promised-by day has ended in the shop's time zone AND status is not `ready_for_pickup` or `picked_up`. Use `isOverdue()` from shared; never compare dates in UTC or the browser's zone.
- Staff screens use `STATUS_LABELS`; the customer page uses `CUSTOMER_STATUS_TEXT`. Never show raw status values.

## Conventions

- Validate every request body with a shared Zod schema; no ad-hoc validation in route handlers.
- Every new endpoint ships with a Supertest test in the same change, beside its router (`routes/tickets.test.ts`).
- Tests sit next to the code as `*.test.ts`.
- Relative TS imports use the `.ts` extension (`./status.ts`).
- Don't edit existing Prisma migrations, the generated client or `.env*` files (hooks block it). Add a new migration; put needed variables in `.env.example`.
- Never reset, drop or truncate the dev database (`npm run db:reset -w apps/api`, `prisma migrate reset`) without asking. Prisma also refuses `migrate reset` from an AI agent.
- API tests that write data call `resetDb()` from `apps/api/test/db.ts` in `beforeEach`; it only runs against a database whose name contains `test`.
- Phones are stored as digits only. `promisedBy` is a `@db.Date`; convert with `toDateString`/`fromDateString` from `src/db.ts` and pass YYYY-MM-DD strings to shared code.
- Keep v1 scope: no payments, inventory, booking, notifications or per-user accounts (see "Not built" in `decisions.md`).

## Working style

- One vertical slice per session (e.g. "status-change endpoint + tests"), ending green with `npm run check`.
- When a slice is green, propose one commit for it with a message saying what the slice does. The commit history is part of the submission.
- When you write tests first, confirm they fail for the right reason before writing the implementation.
