import {
  generateTicketNumber,
  nextStatuses,
  shopToday,
  STATUSES,
  TICKET_NUMBER_PATTERN,
  type Status,
} from "@bike-repair/shared";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetDb } from "../../test/db.ts";
import { staffAgent } from "../../test/session.ts";
import { createApp } from "../app.ts";
import { fromDateString, prisma, shopTimeZone, toDateString } from "../db.ts";

// Wrap the real generator so a test can force a collision.
vi.mock("@bike-repair/shared", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@bike-repair/shared")>();
  return { ...actual, generateTicketNumber: vi.fn(actual.generateTicketNumber) };
});

const app = createApp();

function shopDate(offsetDays: number): string {
  const date = fromDateString(shopToday(new Date(), shopTimeZone()));
  date.setUTCDate(date.getUTCDate() + offsetDays);
  return toDateString(date);
}

const intake = {
  customerName: "Maya Chen",
  phone: "(604) 555-0142",
  bikeDescription: "Blue Trek FX 2 hybrid",
  problem: "Rear brake rubbing",
  promisedBy: shopDate(3),
};

describe("POST /api/tickets", () => {
  let agent: Awaited<ReturnType<typeof staffAgent>>;

  beforeEach(async () => {
    await resetDb();
    agent = await staffAgent(app);
  });

  it("returns 401 without a staff session", async () => {
    const res = await request(app).post("/api/tickets").send(intake);
    expect(res.status).toBe(401);
    expect(await prisma.ticket.count()).toBe(0);
  });

  it("returns 400 with field errors for missing fields", async () => {
    const res = await agent.post("/api/tickets").send({});
    expect(res.status).toBe(400);
    expect(Object.keys(res.body.fieldErrors).sort()).toEqual(
      ["bikeDescription", "customerName", "phone", "promisedBy"].sort(),
    );
    expect(await prisma.ticket.count()).toBe(0);
  });

  it("rejects a promised-by date before today in the shop's time zone", async () => {
    const res = await agent.post("/api/tickets").send({ ...intake, promisedBy: shopDate(-1) });
    expect(res.status).toBe(400);
    expect(res.body.fieldErrors).toHaveProperty("promisedBy");
  });

  it("accepts today as the promised-by date", async () => {
    const res = await agent.post("/api/tickets").send({ ...intake, promisedBy: shopDate(0) });
    expect(res.status).toBe(201);
    expect(res.body.promisedBy).toBe(shopDate(0));
  });

  it("creates the ticket, customer and first event, and returns the ticket", async () => {
    const res = await agent.post("/api/tickets").send(intake);
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      number: expect.stringMatching(TICKET_NUMBER_PATTERN),
      status: "received",
      customer: { name: "Maya Chen", phone: "6045550142" },
      bikeDescription: "Blue Trek FX 2 hybrid",
      problem: "Rear brake rubbing",
      promisedBy: intake.promisedBy,
    });

    const ticket = await prisma.ticket.findUniqueOrThrow({
      where: { number: res.body.number },
      include: { customer: true, events: true },
    });
    expect(ticket.customer.phone).toBe("6045550142");
    expect(toDateString(ticket.promisedBy)).toBe(intake.promisedBy);
    expect(ticket.events).toHaveLength(1);
    expect(ticket.events[0]).toMatchObject({ fromStatus: null, toStatus: "received", note: null });
  });

  it("stores no problem when it is left out", async () => {
    const withoutProblem = { ...intake, problem: undefined };
    const res = await agent.post("/api/tickets").send(withoutProblem);
    expect(res.status).toBe(201);
    expect(res.body.problem).toBeNull();
  });

  it("reuses the customer for a returning phone number, however it's formatted", async () => {
    const first = await agent.post("/api/tickets").send(intake);
    const second = await agent
      .post("/api/tickets")
      .send({ ...intake, phone: "604.555.0142", bikeDescription: "Kids' bike" });
    expect(second.status).toBe(201);
    expect(await prisma.customer.count()).toBe(1);
    expect(second.body.customer.id).toBe(first.body.customer.id);
  });

  it("gives every ticket a different number", async () => {
    const numbers = new Set<string>();
    for (let i = 0; i < 20; i++) {
      numbers.add((await agent.post("/api/tickets").send(intake)).body.number);
    }
    expect(numbers.size).toBe(20);
  });

  it("retries with a new number when the generated one is taken", async () => {
    const first = await agent.post("/api/tickets").send(intake);
    vi.mocked(generateTicketNumber).mockClear().mockReturnValueOnce(first.body.number);

    const second = await agent.post("/api/tickets").send(intake);
    expect(second.status).toBe(201);
    expect(second.body.number).not.toBe(first.body.number);
    expect(generateTicketNumber).toHaveBeenCalledTimes(2);
    expect(await prisma.ticket.count()).toBe(2);
    expect(await prisma.ticketEvent.count()).toBe(2);
  });
});

let phoneSeq = 0;

// Inserts a ticket directly, so tests can set any status, date or creation time
// (intake only allows promised-by dates from today on).
async function makeTicket(t: {
  number: string;
  status?: Status;
  promisedBy: string;
  createdAt?: Date;
  customerName?: string;
}) {
  return prisma.ticket.create({
    data: {
      number: t.number,
      status: t.status ?? "received",
      promisedBy: fromDateString(t.promisedBy),
      createdAt: t.createdAt,
      bikeDescription: `Bike ${t.number}`,
      problem: "Secret internal problem",
      customer: {
        create: {
          name: t.customerName ?? `Customer ${t.number}`,
          phone: `604555${1000 + phoneSeq++}`,
        },
      },
      events: { create: { fromStatus: null, toStatus: "received", note: "Internal note" } },
    },
  });
}

describe("GET /api/tickets (queue)", () => {
  let agent: Awaited<ReturnType<typeof staffAgent>>;

  beforeEach(async () => {
    await resetDb();
    agent = await staffAgent(app);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns 401 without a staff session", async () => {
    const res = await request(app).get("/api/tickets");
    expect(res.status).toBe(401);
  });

  it("lists open tickets with only the queue fields (no phone, problem or notes)", async () => {
    await makeTicket({ number: "AAAA22", promisedBy: "2030-01-01", customerName: "Maya Chen" });
    const res = await agent.get("/api/tickets");
    expect(res.status).toBe(200);
    expect(res.body).toEqual([
      {
        number: "AAAA22",
        customerName: "Maya Chen",
        bikeDescription: "Bike AAAA22",
        status: "received",
        promisedBy: "2030-01-01",
        overdue: false,
      },
    ]);
  });

  it("leaves out picked-up tickets", async () => {
    await makeTicket({ number: "OPEN22", status: "ready_for_pickup", promisedBy: "2030-01-01" });
    await makeTicket({ number: "DONE22", status: "picked_up", promisedBy: "2030-01-01" });
    const res = await agent.get("/api/tickets");
    expect(res.body.map((t: { number: string }) => t.number)).toEqual(["OPEN22"]);
  });

  it("sorts by promised-by date, then by creation time", async () => {
    await makeTicket({
      number: "CCCC22",
      promisedBy: "2030-01-05",
      createdAt: new Date("2026-10-02"),
    });
    await makeTicket({
      number: "AAAA22",
      promisedBy: "2030-01-03",
      createdAt: new Date("2026-10-03"),
    });
    await makeTicket({
      number: "BBBB22",
      promisedBy: "2030-01-05",
      createdAt: new Date("2026-10-01"),
    });
    const res = await agent.get("/api/tickets");
    expect(res.body.map((t: { number: string }) => t.number)).toEqual([
      "AAAA22",
      "BBBB22",
      "CCCC22",
    ]);
  });

  it("filters by status", async () => {
    await makeTicket({ number: "DIAG22", status: "diagnosing", promisedBy: "2030-01-01" });
    await makeTicket({ number: "PART22", status: "waiting_on_parts", promisedBy: "2030-01-01" });
    const res = await agent.get("/api/tickets?status=waiting_on_parts");
    expect(res.status).toBe(200);
    expect(res.body.map((t: { number: string }) => t.number)).toEqual(["PART22"]);
  });

  it("never lists picked-up tickets, even when filtering for them", async () => {
    await makeTicket({ number: "DONE22", status: "picked_up", promisedBy: "2030-01-01" });
    const res = await agent.get("/api/tickets?status=picked_up");
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it("returns 400 for an unknown status filter", async () => {
    const res = await agent.get("/api/tickets?status=lost");
    expect(res.status).toBe(400);
    expect(res.body.fieldErrors).toHaveProperty("status");
  });

  describe("overdue, at the promised-by day's midnight in the shop's time zone", () => {
    // Tests run with SHOP_TIME_ZONE=America/Vancouver (vitest.config.ts): UTC-7 in October.
    beforeEach(async () => {
      await makeTicket({ number: "LATE22", status: "in_progress", promisedBy: "2026-10-13" });
      await makeTicket({ number: "DONE22", status: "ready_for_pickup", promisedBy: "2026-10-13" });
    });

    async function overdueAt(utc: string) {
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(new Date(utc));
      const res = await agent.get("/api/tickets");
      return Object.fromEntries(
        res.body.map((t: { number: string; overdue: boolean }) => [t.number, t.overdue]),
      );
    }

    it("is not overdue at 23:59 shop time on the promised-by day (already the next day in UTC)", async () => {
      expect(await overdueAt("2026-10-14T06:59:00Z")).toEqual({ LATE22: false, DONE22: false });
    });

    it("is overdue from 00:00 shop time the next day, unless ready for pickup", async () => {
      expect(await overdueAt("2026-10-14T07:00:00Z")).toEqual({ LATE22: true, DONE22: false });
    });
  });
});

describe("GET /api/tickets/:number (detail)", () => {
  let agent: Awaited<ReturnType<typeof staffAgent>>;

  beforeEach(async () => {
    await resetDb();
    agent = await staffAgent(app);
  });

  it("returns 401 without a staff session", async () => {
    await makeTicket({ number: "AAAA22", promisedBy: "2030-01-01" });
    const res = await request(app).get("/api/tickets/AAAA22");
    expect(res.status).toBe(401);
  });

  it("returns the ticket with customer contact, overdue and its next statuses", async () => {
    await makeTicket({
      number: "AAAA22",
      status: "diagnosing",
      promisedBy: "2020-01-01",
      customerName: "Maya Chen",
    });
    const res = await agent.get("/api/tickets/AAAA22");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      number: "AAAA22",
      status: "diagnosing",
      customer: { name: "Maya Chen", phone: expect.stringMatching(/^604555\d{4}$/) },
      bikeDescription: "Bike AAAA22",
      problem: "Secret internal problem",
      promisedBy: "2020-01-01",
      overdue: true,
      nextStatuses: ["waiting_on_parts", "in_progress"],
    });
  });

  it("offers exactly the shared rules' next statuses for every status", async () => {
    for (const [i, status] of STATUSES.entries()) {
      const number = `NEXT2${i + 2}`;
      await makeTicket({ number, status, promisedBy: "2030-01-01" });
      const res = await agent.get(`/api/tickets/${number}`);
      expect(res.body.nextStatuses, status).toEqual([...nextStatuses(status)]);
    }
  });

  it("returns the full history, oldest first", async () => {
    const ticket = await makeTicket({
      number: "AAAA22",
      status: "in_progress",
      promisedBy: "2030-01-01",
    });
    // Inserted out of order; the creation event from makeTicket is dated now, so move it first.
    await prisma.ticketEvent.updateMany({
      where: { ticketId: ticket.id },
      data: { createdAt: new Date("2026-10-01T09:00:00Z") },
    });
    await prisma.ticketEvent.create({
      data: {
        ticketId: ticket.id,
        fromStatus: "diagnosing",
        toStatus: "in_progress",
        note: "Parts in",
        createdAt: new Date("2026-10-03T09:00:00Z"),
      },
    });
    await prisma.ticketEvent.create({
      data: {
        ticketId: ticket.id,
        fromStatus: "received",
        toStatus: "diagnosing",
        createdAt: new Date("2026-10-02T09:00:00Z"),
      },
    });

    const res = await agent.get("/api/tickets/AAAA22");
    expect(res.body.history).toEqual([
      { from: null, to: "received", note: "Internal note", createdAt: "2026-10-01T09:00:00.000Z" },
      { from: "received", to: "diagnosing", note: null, createdAt: "2026-10-02T09:00:00.000Z" },
      {
        from: "diagnosing",
        to: "in_progress",
        note: "Parts in",
        createdAt: "2026-10-03T09:00:00.000Z",
      },
    ]);
  });

  it("finds the ticket whatever the case of the number typed", async () => {
    await makeTicket({ number: "ABCD23", promisedBy: "2030-01-01" });
    for (const typed of ["abcd23", "AbCd23"]) {
      const res = await agent.get(`/api/tickets/${typed}`);
      expect(res.status, typed).toBe(200);
      expect(res.body.number).toBe("ABCD23");
    }
  });

  it("returns 404 for an unknown ticket number", async () => {
    await makeTicket({ number: "AAAA22", promisedBy: "2030-01-01" });
    const res = await agent.get("/api/tickets/ZZZZ99");
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: "Ticket not found" });
  });
});

describe("POST /api/tickets/:number/status", () => {
  let agent: Awaited<ReturnType<typeof staffAgent>>;

  beforeEach(async () => {
    await resetDb();
    agent = await staffAgent(app);
  });

  async function stored(number: string) {
    const ticket = await prisma.ticket.findUniqueOrThrow({
      where: { number },
      include: { events: { orderBy: { createdAt: "asc" } } },
    });
    return { status: ticket.status, events: ticket.events };
  }

  it("returns 401 without a staff session and changes nothing", async () => {
    await makeTicket({ number: "AAAA22", promisedBy: "2030-01-01" });
    const res = await request(app).post("/api/tickets/AAAA22/status").send({ to: "diagnosing" });
    expect(res.status).toBe(401);
    expect((await stored("AAAA22")).status).toBe("received");
  });

  it("moves the ticket, writes exactly one event with the trimmed note, and returns the detail", async () => {
    await makeTicket({ number: "AAAA22", promisedBy: "2030-01-01" });
    const res = await agent
      .post("/api/tickets/aaaa22/status")
      .send({ to: "diagnosing", note: "  Checking the brakes  " });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      number: "AAAA22",
      status: "diagnosing",
      customer: { name: "Customer AAAA22" },
      overdue: false,
      nextStatuses: ["waiting_on_parts", "in_progress"],
    });
    expect(res.body.history).toHaveLength(2);
    expect(res.body.history[1]).toMatchObject({
      from: "received",
      to: "diagnosing",
      note: "Checking the brakes",
    });

    const { status, events } = await stored("AAAA22");
    expect(status).toBe("diagnosing");
    expect(events).toHaveLength(2);
    expect(events[1]).toMatchObject({
      fromStatus: "received",
      toStatus: "diagnosing",
      note: "Checking the brakes",
    });
  });

  it("stores no note when it is left out", async () => {
    await makeTicket({ number: "AAAA22", promisedBy: "2030-01-01" });
    await agent.post("/api/tickets/AAAA22/status").send({ to: "diagnosing" });
    expect((await stored("AAAA22")).events[1].note).toBeNull();
  });

  it("returns 409 with the allowed next statuses for a disallowed move, writing nothing", async () => {
    await makeTicket({ number: "AAAA22", promisedBy: "2030-01-01" });
    const res = await agent.post("/api/tickets/AAAA22/status").send({ to: "ready_for_pickup" });
    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: expect.any(String), allowed: ["diagnosing"] });

    const { status, events } = await stored("AAAA22");
    expect(status).toBe("received");
    expect(events).toHaveLength(1);
  });

  it("treats picked up as final", async () => {
    await makeTicket({ number: "DONE22", status: "picked_up", promisedBy: "2030-01-01" });
    for (const to of STATUSES) {
      const res = await agent.post("/api/tickets/DONE22/status").send({ to });
      expect(res.status, to).toBe(409);
      expect(res.body.allowed, to).toEqual([]);
    }
    expect((await stored("DONE22")).events).toHaveLength(1);
  });

  it("returns 400 for a note over 500 characters or an unknown status, writing nothing", async () => {
    await makeTicket({ number: "AAAA22", promisedBy: "2030-01-01" });
    const longNote = await agent
      .post("/api/tickets/AAAA22/status")
      .send({ to: "diagnosing", note: "x".repeat(501) });
    expect(longNote.status).toBe(400);
    expect(longNote.body.fieldErrors).toHaveProperty("note");

    const unknown = await agent.post("/api/tickets/AAAA22/status").send({ to: "lost" });
    expect(unknown.status).toBe(400);
    expect(unknown.body.fieldErrors).toHaveProperty("to");

    const { status, events } = await stored("AAAA22");
    expect(status).toBe("received");
    expect(events).toHaveLength(1);
  });

  it("returns 404 for an unknown ticket number", async () => {
    const res = await agent.post("/api/tickets/ZZZZ99/status").send({ to: "diagnosing" });
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: "Ticket not found" });
  });

  // Polls until some request is blocked waiting for a row lock.
  async function waitForBlockedRequest() {
    for (let i = 0; i < 200; i++) {
      const [{ blocked }] = await prisma.$queryRaw<{ blocked: number }[]>`
        SELECT count(*)::int AS blocked FROM pg_stat_activity
        WHERE datname = current_database() AND wait_event_type = 'Lock'`;
      if (blocked > 0) return;
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    throw new Error("The request never blocked on the ticket's row lock");
  }

  it("lets only one of two simultaneous changes win; the other gets 409", async () => {
    const ticket = await makeTicket({
      number: "RACE22",
      status: "diagnosing",
      promisedBy: "2030-01-01",
    });

    // Force the losing interleaving: another staff member's change locks the row, our
    // request reads "diagnosing" and blocks on its update, then the other change commits.
    let pending!: Promise<request.Response>;
    await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Ticket" WHERE id = ${ticket.id} FOR UPDATE`;
      pending = agent
        .post("/api/tickets/RACE22/status")
        .send({ to: "in_progress" })
        .then((res) => res);
      await waitForBlockedRequest();
      await tx.ticket.update({ where: { id: ticket.id }, data: { status: "waiting_on_parts" } });
      await tx.ticketEvent.create({
        data: { ticketId: ticket.id, fromStatus: "diagnosing", toStatus: "waiting_on_parts" },
      });
    });

    const res = await pending;
    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: expect.any(String), allowed: ["in_progress"] });

    const { status, events } = await stored("RACE22");
    expect(status).toBe("waiting_on_parts");
    expect(events.map((e) => e.toStatus)).toEqual(["received", "waiting_on_parts"]);
  });
});
