import { shopToday, type Status } from "@bike-repair/shared";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { resetDb } from "../../test/db.ts";
import { staffAgent } from "../../test/session.ts";
import { createApp } from "../app.ts";
import { fromDateString, shopTimeZone, toDateString } from "../db.ts";

const NOT_FOUND = { error: "We couldn't find a repair with that ticket number and phone number." };

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

describe("POST /api/lookup", () => {
  // A fresh app per test, so each starts with its own lookup rate limit.
  let app: ReturnType<typeof createApp>;
  let staff: Awaited<ReturnType<typeof staffAgent>>;
  let number: string;

  beforeEach(async () => {
    await resetDb();
    app = createApp();
    staff = await staffAgent(app);
    const res = await staff.post("/api/tickets").send(intake);
    expect(res.status).toBe(201);
    number = res.body.number;
  });

  async function moveTo(...statuses: Status[]) {
    for (const to of statuses) {
      const res = await staff.post(`/api/tickets/${number}/status`).send({ to });
      expect(res.status).toBe(200);
    }
  }

  function lookup(body: object) {
    // No session cookie: the lookup is public.
    return request(app).post("/api/lookup").send(body);
  }

  it("returns only the ticket number, status and promised-by date for a match", async () => {
    const res = await lookup({ ticketNumber: number, phoneLast4: "0142" });
    expect(res.status).toBe(200);
    // The exact key set, so a field added later can't leak to customers unnoticed.
    expect(Object.keys(res.body).sort()).toEqual(["promisedBy", "status", "ticketNumber"]);
    expect(res.body).toEqual({
      ticketNumber: number,
      status: "received",
      promisedBy: intake.promisedBy,
    });
  });

  it("works without a staff session", async () => {
    const res = await request(createApp())
      .post("/api/lookup")
      .send({ ticketNumber: number, phoneLast4: "0142" });
    expect(res.status).toBe(200);
  });

  it("matches the ticket number in any case", async () => {
    const res = await lookup({ ticketNumber: number.toLowerCase(), phoneLast4: "0142" });
    expect(res.status).toBe(200);
    expect(res.body.ticketNumber).toBe(number);
  });

  it("returns the same 404 for an unknown ticket and for wrong phone digits", async () => {
    const unknownNumber = number === "ZZZZZZ" ? "YYYYYY" : "ZZZZZZ";
    const unknown = await lookup({ ticketNumber: unknownNumber, phoneLast4: "0142" });
    const wrongDigits = await lookup({ ticketNumber: number, phoneLast4: "0143" });
    // Digits from the start of the phone aren't its last 4.
    const firstDigits = await lookup({ ticketNumber: number, phoneLast4: "6045" });

    for (const res of [unknown, wrongDigits, firstDigits]) {
      expect(res.status).toBe(404);
      expect(res.body).toEqual(NOT_FOUND);
    }
  });

  it("returns 400 with field errors for invalid input", async () => {
    const res = await lookup({ ticketNumber: "K7P2Q", phoneLast4: "42" });
    expect(res.status).toBe(400);
    expect(Object.keys(res.body.fieldErrors).sort()).toEqual(["phoneLast4", "ticketNumber"]);
  });

  it("still finds a ticket after it's been picked up", async () => {
    await moveTo("diagnosing", "in_progress", "ready_for_pickup", "picked_up");
    const res = await lookup({ ticketNumber: number, phoneLast4: "0142" });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("picked_up");
  });

  it("never shows staff notes or customer details", async () => {
    const note = "Customer declined the new chain";
    const change = await staff
      .post(`/api/tickets/${number}/status`)
      .send({ to: "diagnosing", note });
    expect(change.status).toBe(200);

    const res = await lookup({ ticketNumber: number, phoneLast4: "0142" });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("diagnosing");
    for (const secret of [note, intake.customerName, "6045550142", intake.problem]) {
      expect(res.text).not.toContain(secret);
    }
  });
});
