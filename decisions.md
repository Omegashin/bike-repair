# Bike Shop Repair Tracker — Decision Document

Oct 13, 2026 · Arshdeep Saini · **Time spent:** ~6 hours

A repair ticket tracker. Staff log a bike at drop-off and move it through a fixed set of statuses; customers check progress with their ticket number and phone digits.

## Assumptions

The owner wasn't available, so the app rests on these assumptions.

- **Shop:** one independent location, 2–5 staff, 1–3 mechanics. Repairs drive margin and peak in spring.
- **Today:** repair jobs are tracked on paper tags, a whiteboard, or memory.
- **Existing tools:** a POS handles payments and retail inventory, but not repair tracking. This app doesn't replace the POS.
- **Data:** tens of open tickets and up to a few thousand a year, so one relational database is plenty. The phone number taken at drop-off can verify a status lookup.

**Riskiest assumption:** that the POS doesn't track repairs. Some bike-shop POS systems include work orders. If this shop's does, the ticket system is redundant and the value shifts to the customer status page and notifications built on the POS's data. This is the first thing I'd confirm with the owner.

## Users and problems

| User                        | Context and needs                                                       | Problems today                                                                     |
| --------------------------- | ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Mechanics and counter staff | Shared desktop or tablet, often mid-job; speed over features            | Lost or forgotten bikes; no view of what's due next; phone calls interrupt repairs |
| Customers                   | Non-technical, on a phone, won't make an account; want to know "ready?" | No way to know when the bike is ready except calling                               |
| Owner                       | Often working the counter too; wants fewer lost jobs and status calls   | No view of overdue or stalled jobs; lost jobs cost money and reputation            |

## Problem selection

**Chosen:** the shop can't reliably track repair jobs, and customers can't check on their bike without calling.

| Candidate                  | Who feels it            | Decision                                                             |
| -------------------------- | ----------------------- | -------------------------------------------------------------------- |
| Repair tracking and status | Staff, customers, owner | **Build**                                                            |
| Online booking             | Customers, staff        | Later: large scope, and work should be tracked before more is booked |
| Inventory and online sales | Owner, staff            | Skip: the POS covers it                                              |
| Staff scheduling           | Owner                   | Skip: low pain for 2–5 staff                                         |

**Why this first:** service is where the shop earns its margin, so lost time costs money; it's the only problem all three user groups feel daily; and it's the base for later features (notifications, service history, booking).

## Scope

Version 1 has four features.

1. **Intake:** staff enter customer name, phone, bike, an optional problem and a promised-by date (today or later, in the shop's time zone), and get a ticket number for the bike tag. Numbers are 6 random characters without look-alikes (0/O, 1/I/L), so handwritten tags read back correctly and numbers don't reveal neighbouring tickets. Phones are stored as digits only; a returning customer's phone reuses their record.
2. **Queue:** all tickets not yet picked up, sorted by promised-by date and filterable by status. A ticket is **overdue** when its promised-by day has ended and it isn't Ready for pickup or Picked up.
3. **Status updates:** staff move a ticket to an allowed next status with an optional internal note. Every change is stored as an event, giving each ticket a full history.
4. **Customer lookup:** ticket number plus the last 4 phone digits shows the current status and promised-by date. No login; notes, customer details and history are never shown. The form posts its fields, so phone digits stay out of URLs, browser history and logs.

**Status rules** (shared by the API and UI; the API rejects anything else):

| From             | Allowed next                       |
| ---------------- | ---------------------------------- |
| Received         | Diagnosing                         |
| Diagnosing       | Waiting on parts, In progress      |
| Waiting on parts | In progress                        |
| In progress      | Waiting on parts, Ready for pickup |
| Ready for pickup | Picked up                          |
| Picked up        | — (final)                          |

**Not built:**

| Left out                        | Why                                                                |
| ------------------------------- | ------------------------------------------------------------------ |
| Payments and inventory          | The POS handles them                                               |
| Online booking                  | Track existing work before scheduling more                         |
| SMS and email notifications     | Needs a paid provider; first next step                             |
| Per-user staff accounts         | A shared login suits a small shop, but changes aren't attributed   |
| Bike records and cost approvals | Bike is free text, so visits aren't linked; next once tickets work |

## User experience

- **Staff:** the queue is the landing page, since "what's due next?" is the most frequent question. Overdue tickets carry an "Overdue" tag (not colour alone), buttons are touch-sized, and a ticket offers only the statuses it can move to. If two people change a ticket at once, the second is told and sees the current status.
- **Intake:** only the fields needed to find and contact the customer are required, with errors next to each field. The new ticket number is shown large, ready to copy onto the tag.
- **Customers:** one mobile-first page with one form and no links into the staff side, in plain language, with "ready to pick up" made prominent.
- **Dates** follow the shop's time zone, never the device's, so a tablet or phone set to another zone still shows the right day.

## Technical choices

A TypeScript monorepo (npm workspaces): React frontend, REST API and PostgreSQL, run locally with one Docker Compose command. I chose a stack I can build in quickly and that a future developer at a small shop could pick up easily.

| Layer              | Choice                                                      | Why                                                                                           |
| ------------------ | ----------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Frontend           | React + Vite + TypeScript, Tailwind                         | Simple single-page app with fast builds; Tailwind makes the touch-sized layout quick to build |
| API                | Node.js + Express + TypeScript                              | Small, explicit REST API that is easy to read and extend                                      |
| Shared             | Zod schemas and status-transition rules in a shared package | One source of truth for validation and business rules on both sides                           |
| Database           | PostgreSQL + Prisma                                         | Customers, tickets and history are relational; Prisma gives typed queries and migrations      |
| Tests              | Vitest + Supertest, Playwright                              | Fast unit tests for rules; real HTTP requests for the API; one browser test of the core path  |
| Local dev          | Docker Compose                                              | One command runs Postgres and the app exactly as in production, with seed data                |
| Hosting (optional) | Render web service (Docker) + Render Postgres               | Free tiers; one service serves both API and frontend                                          |

**Architecture:** the browser calls the REST API, which validates every request with Zod, applies the status rules, and uses PostgreSQL through Prisma. Staff endpoints require the shared staff login. The public lookup endpoint is limited to 10 attempts per client IP per 15 minutes. In production, Express serves both `/api` and the built React app from one URL, so there's one deploy and no CORS setup.

**Data model:** `Customer` (name, unique digits-only phone) → `Ticket` (public number, bike, optional problem, status, promised-by date) → `TicketEvent` (from and to status, note, timestamp). A status change updates the ticket and writes its event in one transaction, so history can't drift from the current status.

**Error contract:**

- `400` with field-level errors from the same Zod schemas the UI uses.
- `409` for a disallowed status change, with the allowed next statuses.
- `401` for staff endpoints without a valid session.
- `404` with the same body for a wrong ticket number or wrong phone digits, so lookups don't reveal which tickets exist.

**Deployment:** live at <https://bike-repair-ylfl.onrender.com/>. Render builds the same `Dockerfile` that `npm run start` uses; on each deploy the container runs `prisma migrate deploy` and the seed (which skips once tickets exist) before starting. The environment-specific settings are the database URL, the shop's time zone, the staff password and session secret, and `TRUST_PROXY=1` so the lookup's rate limit sees each client's IP behind Render's proxy.

## Testing approach

Tests target the places where a bug would cost the shop most:

- **Status and overdue rules (unit):** every allowed and disallowed transition, and the overdue cutoff at midnight in the shop's time zone. The core rules, and cheap to test exhaustively.
- **API (integration, Supertest against a test Postgres):** intake validation, status changes writing events, `409` on invalid or simultaneous changes, lookup hits and misses, and `401` without a session.
- **End to end (Playwright, desktop and mobile):** one test of intake → ready for pickup → customer lookup, the path the app exists for. The rest of the UI is a thin layer over the tested API and rules, so it has no further UI tests.

## Trade-offs and limitations

- **Weak customer verification:** ticket number plus last 4 phone digits stops casual guessing but isn't strong authentication. Acceptable because the lookup returns only status and a date.
- **No cancelled status:** a declined repair has to be moved through to Picked up with a note.
- **Single shop, single time zone:** overdue logic assumes one location.
- **Customer data retention:** names and phones are kept indefinitely, with no deletion flow.
- **Free-tier hosting:** Render's free instance sleeps after 15 minutes idle, so the first request can take about a minute. Render deletes free Postgres databases after 30 days, so the live demo needs a paid database to last longer.

## Next steps

In priority order, by what removes the most phone calls and lost work:

1. **Confirm assumptions with the owner**, starting with whether the POS already tracks repairs.
2. **SMS or email when a bike is ready:** the biggest cut to status calls.
3. **Cost estimates and customer approval** from the status page, replacing mid-job calls; adds a Declined status.
4. **Per-user staff accounts:** attribute each change and give the owner a role.
5. **Bike records and service history:** link visits to a bike.
6. **Owner reporting:** turnaround time, overdue rate and seasonal volume.
7. **Online booking** of drop-off slots, once tracking works.
8. **Production hosting:** an always-on instance and error monitoring such as Sentry.

## How I used AI

I built this with Claude Code (Claude Opus 5.5) as a pair programmer; every commit is marked as co-authored with it.

**What I decided:** the problem, users, assumptions, scope, status rules, data model and error contract. They're in this document, which I wrote before any code (it is the first commit).

**How I kept the AI to my spec:**

- **Rules as tests first.** The status table is written out independently in [status.test.ts](packages/shared/src/status.test.ts), and the agent implemented `status.ts` against it. The end-to-end test was committed as a pending spec before the features it covers.
- **A harness instead of trust.** [CLAUDE.md](CLAUDE.md) turns this document's invariants into rules for the agent (e.g. lookups never return notes or names). Hooks format and typecheck every edit, block edits to applied migrations, generated code and `.env` files, and stop the agent from finishing while `npm run check` fails.
- **One vertical slice per session**, each ending green and committed, so I reviewed the work in small pieces.

**What the AI generated:** most of the code and tests within those constraints: scaffolding, Express routes, React pages and Tailwind layouts, Supertest and Playwright tests, and drafts of commit messages and README text.
