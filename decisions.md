# Bike Shop Repair Tracker — Decision Document

Oct 13, 2026 · Arshdeep Saini · **Time spent:** ~[TODO] hours

A repair ticket tracker. Staff log a bike at drop-off and move it through a fixed set of statuses; customers check progress with their ticket number and phone digits. I chose it because repairs are where the shop earns its margin, and today they're tracked on paper.

## Assumptions

The owner wasn't available, so the app rests on these assumptions.

- **Shop:** one independent location, 2–5 staff, 1–3 mechanics. Repairs drive margin and peak in spring.
- **Today:** repair jobs are tracked on paper tags, a whiteboard, or memory.
- **Existing tools:** a POS handles payments and retail inventory, but not repair tracking. This app doesn't replace the POS.
- **Staff:** work from a shared counter desktop or workshop tablet, often mid-job. They need speed over features, and one shared login is enough.
- **Customers:** non-technical, on their phones, and won't create an account. They mainly want to know when the bike is ready.
- **Owner:** wants fewer lost jobs and fewer status calls.
- **Data:** tens of open tickets and up to a few thousand a year, so one relational database is plenty. The phone number taken at drop-off can verify a status lookup.

**Riskiest assumption:** that the POS doesn't track repairs. Some bike-shop POS systems include work orders. If this shop's does, the ticket system is redundant, and the value shifts to the customer status page and notifications built on the POS's data. This is the first thing I'd confirm with the owner.

## Users and problems

| User                        | Context                              | Problems today                                                                     |
| --------------------------- | ------------------------------------ | ---------------------------------------------------------------------------------- |
| Mechanics and counter staff | Shared desktop or tablet, hands busy | Lost or forgotten bikes; no view of what's due next; phone calls interrupt repairs |
| Customers                   | Phone, no account                    | No way to know when the bike is ready except calling                               |
| Owner                       | Also often working the counter       | No view of overdue or stalled jobs; lost jobs cost money and reputation            |

## Problem selection

**Chosen:** the shop can't reliably track repair jobs, and customers can't check on their bike without calling.

| Candidate                  | Who feels it            | Decision                                                             |
| -------------------------- | ----------------------- | -------------------------------------------------------------------- |
| Repair tracking and status | Staff, customers, owner | **Build:** daily pain for all three users, core to margin            |
| Online booking             | Customers, staff        | Later: large scope, and work should be tracked before more is booked |
| Inventory and online sales | Owner, staff            | Skip: the POS covers it                                              |
| Staff scheduling           | Owner                   | Skip: low pain for 2–5 staff                                         |

**Why this first:**

- Service is where the shop earns its margin, so lost time costs money.
- It's the only candidate all three user groups feel.
- It's the base for later features: notifications, service history, tune-up reminders and booking.

## Scope

Version 1 is a repair ticket tracker with four features.

1. **Intake:** staff create a ticket with customer name, phone, bike description, problem and promised-by date, and get a short ticket number to write on the bike tag: 6 random characters from uppercase letters and digits, leaving out look-alikes (0/O, 1/I/L) so handwritten tags read back correctly. Random rather than sequential, so numbers don't reveal neighbouring tickets; a rare collision is retried. Name, phone, bike and promised-by date (today or later, in the shop's time zone) are required; the problem is optional. Phones are stored as digits only (10–15), and a returning customer's phone reuses their existing record.
2. **Queue:** all tickets not yet picked up, filterable by status and sorted by promised-by date. A ticket is **overdue** when its promised-by date has passed and it isn't Ready for pickup or Picked up.
3. **Status updates:** staff move a ticket to its next status with an optional internal note. Every change is stored as an event, giving the ticket a full history.
4. **Customer lookup:** ticket number (any case) plus the last 4 digits of the phone shows the current status and promised-by date, including after pickup. No login, and internal notes, customer details and history are never shown. The form posts its fields rather than putting them in the URL, so phone digits stay out of browser history and server logs.

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

| Left out                        | Why                                        |
| ------------------------------- | ------------------------------------------ |
| Payments and inventory          | The POS handles them                       |
| Online booking                  | Track existing work before scheduling more |
| SMS and email notifications     | Needs a paid provider; first next step     |
| Per-user staff accounts         | A shared login suits a small shop for now  |
| Bike records and cost approvals | Natural next steps once tickets work       |

## User experience

- **Staff:** the queue is the landing page, since "what's due next?" is the most frequent question. Overdue tickets are highlighted, buttons are sized for touch, and each ticket shows only the statuses it can move to, so invalid jumps aren't offered.
- **Intake:** only the fields needed to find and contact the customer are required; validation errors appear next to the field.
- **Customers:** a single mobile-first page with one form. Statuses are shown in plain language.

## Technical choices

A TypeScript monorepo (npm workspaces): a React frontend, a REST API, and PostgreSQL, run locally with one Docker Compose command.

| Layer              | Choice                                                      | Why                                                                                           |
| ------------------ | ----------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Frontend           | React + Vite + TypeScript, Tailwind                         | Simple single-page app with fast builds; Tailwind makes the touch-sized layout quick to build |
| API                | Node.js + Express + TypeScript                              | Small, explicit REST API that is easy to read and extend                                      |
| Shared             | Zod schemas and status-transition rules in a shared package | One source of truth for validation and business rules on both sides                           |
| Database           | PostgreSQL + Prisma                                         | Customers, tickets and history are relational; Prisma gives typed queries and migrations      |
| Tests              | Vitest + Supertest, Playwright                              | Fast unit tests for rules; real HTTP requests for the API; one browser test of the core path  |
| Local dev          | Docker Compose                                              | One command runs Postgres and the app exactly as in production, with seed data                |
| Hosting (optional) | Render web service + Neon Postgres                          | Free tiers; one service serves both API and frontend                                          |

I chose a stack I can build in quickly and that a future developer at a small shop could pick up easily.

**Architecture:** the browser calls the REST API, which validates every request with Zod, applies the status rules, and reads and writes PostgreSQL through Prisma. Staff endpoints (create, list, view with history, change status) require the shared staff login. The customer lookup is a separate public endpoint, limited to 10 attempts per client IP per 15 minutes, that returns only status and promised-by date.

**Data model:**

- `Customer`: name, phone (unique, digits only).
- `Ticket`: public ticket number, customer, bike description, problem (optional), status, promised-by date.
- `TicketEvent`: ticket, from status, to status, note, timestamp.

A status change updates the ticket and writes its event in one transaction, so the history can't drift from the current status.

**Error handling and validation:**

- Invalid input returns `400` with field-level errors from the same Zod schemas the UI uses.
- A disallowed status change returns `409` with the allowed next statuses.
- Staff endpoints return `401` without a valid session.
- A lookup with a wrong ticket number or wrong phone digits returns the same `404`, so responses don't reveal which tickets exist.

**Deployment:** in production, Express serves both `/api` and the built React files from one URL, so there's one deploy and no CORS setup. Render runs `prisma migrate deploy` on each build; the environment-specific settings are the database URL, the shop's time zone, the staff password and session secret, and `TRUST_PROXY=1` so the lookup's rate limit sees each client's IP behind Render's proxy.

## Testing approach

Tests target the places where a bug would cost the shop most:

- **Status and overdue rules (unit):** every allowed and disallowed transition, and the overdue cutoff at midnight in the shop's time zone. These are the core business rules and cheap to test exhaustively.
- **API (integration, Supertest against a test Postgres):** intake validation, status change writes an event, invalid transitions return `409`, lookup hits and misses, and staff endpoints reject unauthenticated requests.
- **End to end (Playwright, desktop and mobile):** one test of intake → ready for pickup → customer lookup, the path the whole app exists for. The rest of the UI is a thin layer over the tested API and shared rules, so it has no further UI tests.

Run with `npm run check` (typecheck, lint, formatting, unit and API tests; needs Postgres from `npm run db:up`) and `npm run test:e2e`.

## Trade-offs and limitations

These shortcuts keep the first version small; each is a known gap.

- **Shared staff login:** status changes aren't attributed to a person.
- **Weak customer verification:** ticket number plus last 4 phone digits stops casual guessing but isn't strong authentication. It's acceptable because the lookup returns only status and a date.
- **No cancelled status:** a customer who declines the repair has to be moved through to Picked up with a note.
- **No notifications:** customers still have to check the page.
- **Bike stored as text:** service history across visits isn't linked.
- **Single shop, single time zone:** overdue logic assumes one location.
- **Customer data retention:** names and phone numbers are kept indefinitely, with no deletion flow.
- **Free-tier hosting:** Render's free instance sleeps after 15 minutes idle, so the first request can take about a minute.

## Next steps

In priority order, based on what removes the most phone calls and lost work:

1. **Confirm assumptions with the owner**, starting with whether the POS already tracks repairs.
2. **SMS or email when a bike is ready:** the biggest cut to status calls.
3. **Cost estimates and customer approval:** the mechanic adds an estimate and the customer approves it from the status page, replacing mid-job calls. Adds a Declined/Cancelled status.
4. **Per-user staff accounts:** attribute each change and give the owner a role.
5. **Bike records and service history:** link visits to a bike.
6. **Owner reporting:** turnaround time, overdue rate and seasonal volume.
7. **Online booking:** once tracking works, let customers book drop-off slots.
8. **Production hosting:** an always-on instance and error monitoring such as Sentry.

## How I used AI

[TODO: be specific. For example: which tool, what it generated (scaffolding, Tailwind layouts, test cases), what you wrote or decided yourself (scope, data model, status rules), and one thing you corrected in its output.]
