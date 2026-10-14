import { lookupSchema } from "@bike-repair/shared";
import { Router } from "express";
import { prisma, toDateString } from "../db.ts";

// Same body for an unknown ticket and for wrong phone digits, so a lookup can't be
// used to find out which ticket numbers exist.
const NOT_FOUND = { error: "We couldn't find a repair with that ticket number and phone number." };

// Public customer lookup: no staff session. POST so the phone digits stay out of
// URLs, browser history and request logs.
export function createLookupRouter() {
  const router = Router();

  router.post("/", async (req, res) => {
    const { ticketNumber, phoneLast4 } = lookupSchema.parse(req.body);
    const ticket = await prisma.ticket.findUnique({
      where: { number: ticketNumber },
      select: {
        number: true,
        status: true,
        promisedBy: true,
        customer: { select: { phone: true } },
      },
    });
    if (!ticket || !ticket.customer.phone.endsWith(phoneLast4)) {
      res.status(404).json(NOT_FOUND);
      return;
    }
    // Only these three fields. Never notes, name, phone, history or internal IDs.
    res.json({
      ticketNumber: ticket.number,
      status: ticket.status,
      promisedBy: toDateString(ticket.promisedBy),
    });
  });

  return router;
}
