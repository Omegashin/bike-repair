import { createIntakeSchema, generateTicketNumber, shopToday } from "@bike-repair/shared";
import { Router } from "express";
import { fromDateString, prisma, shopTimeZone, toDateString } from "../db.ts";
import { Prisma } from "../generated/prisma/client.ts";

// Staff endpoints. Mounted behind requireStaff in app.ts.
export const ticketsRouter = Router();

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

// Intake: create (or reuse) the customer, the ticket and its first event in one transaction.
ticketsRouter.post("/", async (req, res) => {
  const input = createIntakeSchema(shopToday(new Date(), shopTimeZone())).parse(req.body);

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
