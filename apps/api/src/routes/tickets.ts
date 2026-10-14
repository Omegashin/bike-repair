import {
  createIntakeSchema,
  generateTicketNumber,
  isOverdue,
  queueQuerySchema,
  shopToday,
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

type RouterOptions = {
  // The shop's IANA time zone, read once at startup (see createApp).
  timeZone: string;
};

// Staff endpoints. Mounted behind requireStaff in app.ts.
export function createTicketsRouter({ timeZone }: RouterOptions) {
  const router = Router();

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

  return router;
}
