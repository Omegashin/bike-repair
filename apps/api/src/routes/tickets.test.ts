import { generateTicketNumber, shopToday, TICKET_NUMBER_PATTERN } from "@bike-repair/shared";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
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
