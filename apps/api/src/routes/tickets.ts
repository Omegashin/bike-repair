import {
  canTransition,
  createIntakeSchema,
  generateTicketNumber,
  isOverdue,
  nextStatuses,
  queueQuerySchema,
  shopToday,
  STATUS_LABELS,
  statusChangeSchema,
} from "@bike-repair/shared";
import { Router } from "express";
import { fromDateString, prisma, toDateString } from "../db.ts";
import { Prisma } from "../generated/prisma/client.ts";

// A random ticket number can collide with an existing one; retrying with a new
// number makes repeated collisions vanishingly unlikely.
const MAX_ATTEMPTS = 5;

function isUniqueViolation(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";
}

type TicketWithCustomer = Prisma.TicketGetPayload<{ include: { customer: true } }>;

function toTicketJson(ticket: TicketWithCustomer) {
  return {
    id: ticket.id,
    number: ticket.number,
    status: ticket.status,
    customer: { id: ticket.customer.id, name: ticket.customer.name, phone: ticket.customer.phone },
    bikeDescription: ticket.bikeDescription,
    problem: ticket.problem,
    promisedBy: toDateString(ticket.promisedBy),
    createdAt: ticket.createdAt,
  };
}

// The detail view: the ticket with its full history, oldest first.
const withHistory = {
  customer: true,
  events: { orderBy: { createdAt: "asc" } },
} satisfies Prisma.TicketInclude;

type TicketWithHistory = Prisma.TicketGetPayload<{ include: typeof withHistory }>;

// Ticket numbers are stored uppercase; staff may type them from the tag in any case.
function normalizeNumber(number: string): string {
  return number.toUpperCase();
}

type RouterOptions = {
  // The shop's IANA time zone, read once at startup (see createApp).
  timeZone: string;
};

// Staff endpoints. Mounted behind requireStaff in app.ts.
export function createTicketsRouter({ timeZone }: RouterOptions) {
  const router = Router();

  function toDetailJson(ticket: TicketWithHistory) {
    const json = toTicketJson(ticket);
    return {
      ...json,
      overdue: isOverdue(json, new Date(), timeZone),
      nextStatuses: nextStatuses(ticket.status),
      history: ticket.events.map((event) => ({
        from: event.fromStatus,
        to: event.toStatus,
        note: event.note,
        createdAt: event.createdAt,
      })),
    };
  }

  // Queue: every ticket not yet picked up, due soonest first. No pagination: a small
  // shop has tens of open tickets. Only what the queue shows; no phone or notes.
  router.get("/", async (req, res) => {
    const { status } = queueQuerySchema.parse(req.query);
    const tickets = await prisma.ticket.findMany({
      where: { status: { equals: status, not: "picked_up" } },
      orderBy: [{ promisedBy: "asc" }, { createdAt: "asc" }],
      include: { customer: { select: { name: true } } },
    });
    const now = new Date();
    res.json(
      tickets.map((ticket) => {
        const promisedBy = toDateString(ticket.promisedBy);
        return {
          number: ticket.number,
          customerName: ticket.customer.name,
          bikeDescription: ticket.bikeDescription,
          status: ticket.status,
          promisedBy,
          overdue: isOverdue({ status: ticket.status, promisedBy }, now, timeZone),
        };
      }),
    );
  });

  // Intake: create (or reuse) the customer, the ticket and its first event in one transaction.
  router.post("/", async (req, res) => {
    const input = createIntakeSchema(shopToday(new Date(), timeZone)).parse(req.body);

    for (let attempt = 1; ; attempt++) {
      try {
        const ticket = await prisma.$transaction(async (tx) => {
          // A returning customer (same phone) keeps their existing record and name.
          const customer = await tx.customer.upsert({
            where: { phone: input.phone },
            create: { name: input.customerName, phone: input.phone },
            update: {},
          });
          return tx.ticket.create({
            data: {
              number: generateTicketNumber(),
              customerId: customer.id,
              bikeDescription: input.bikeDescription,
              problem: input.problem ?? null,
              promisedBy: fromDateString(input.promisedBy),
              events: { create: { fromStatus: null, toStatus: "received" } },
            },
            include: { customer: true },
          });
        });
        res.status(201).json(toTicketJson(ticket));
        return;
      } catch (err) {
        // Also covers two intakes racing to create the same new customer.
        if (isUniqueViolation(err) && attempt < MAX_ATTEMPTS) continue;
        throw err;
      }
    }
  });

  // Detail: everything staff need at the counter, including contact details and history.
  router.get("/:number", async (req, res) => {
    const ticket = await prisma.ticket.findUnique({
      where: { number: normalizeNumber(req.params.number) },
      include: withHistory,
    });
    if (!ticket) {
      res.status(404).json({ error: "Ticket not found" });
      return;
    }
    res.json(toDetailJson(ticket));
  });

  // Status change: update the ticket and write its event in one transaction.
  router.post("/:number/status", async (req, res) => {
    const { to, note } = statusChangeSchema.parse(req.body);
    const ticket = await prisma.ticket.findUnique({
      where: { number: normalizeNumber(req.params.number) },
    });
    if (!ticket) {
      res.status(404).json({ error: "Ticket not found" });
      return;
    }
    const from = ticket.status;
    if (!canTransition(from, to)) {
      res.status(409).json({
        error: `Can't move a ticket from ${STATUS_LABELS[from]} to ${STATUS_LABELS[to]}`,
        allowed: nextStatuses(from),
      });
      return;
    }

    const updated = await prisma.$transaction(async (tx) => {
      // Only if the status is still the one checked above: when two staff change the
      // same ticket at once, the second update waits for the first, then matches nothing.
      const { count } = await tx.ticket.updateMany({
        where: { id: ticket.id, status: from },
        data: { status: to },
      });
      if (count === 0) return null;
      await tx.ticketEvent.create({
        data: { ticketId: ticket.id, fromStatus: from, toStatus: to, note: note ?? null },
      });
      return tx.ticket.findUniqueOrThrow({ where: { id: ticket.id }, include: withHistory });
    });

    if (!updated) {
      const current = await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } });
      res.status(409).json({
        error: "Someone else just changed this ticket's status. Check it and try again.",
        allowed: nextStatuses(current.status),
      });
      return;
    }
    res.json(toDetailJson(updated));
  });

  return router;
}
