import { STATUSES } from "@bike-repair/shared";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { resetDb } from "../test/db.ts";
import { fromDateString, prisma, toDateString } from "./db.ts";
import { TicketStatus } from "./generated/prisma/enums.ts";

describe("database schema", () => {
  beforeEach(resetDb);
  afterAll(() => prisma.$disconnect());

  it("TicketStatus enum matches the shared STATUSES", () => {
    expect(Object.values(TicketStatus)).toEqual([...STATUSES]);
  });

  it("stores a ticket with its creation event and round-trips promisedBy as a calendar date", async () => {
    const ticket = await prisma.ticket.create({
      data: {
        number: "TEST01",
        bikeDescription: "Blue hybrid",
        problem: "Flat tire",
        promisedBy: fromDateString("2026-10-20"),
        customer: { create: { name: "Test Customer", phone: "6045550100" } },
        events: { create: { fromStatus: null, toStatus: "received" } },
      },
      include: { events: true },
    });

    expect(ticket.status).toBe("received");
    expect(toDateString(ticket.promisedBy)).toBe("2026-10-20");
    expect(ticket.events).toHaveLength(1);
  });
});
