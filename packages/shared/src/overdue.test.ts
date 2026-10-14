import { describe, expect, it } from "vitest";
import { isOverdue, shopToday } from "./overdue.ts";
import { STATUSES } from "./status.ts";

const TZ = "America/Vancouver"; // UTC-7 in October (PDT)

describe("shopToday", () => {
  it("uses the shop's calendar date, not UTC's", () => {
    // 03:00 UTC on Oct 14 is still 20:00 on Oct 13 in Vancouver.
    expect(shopToday(new Date("2026-10-14T03:00:00Z"), TZ)).toBe("2026-10-13");
  });
});

describe("isOverdue", () => {
  const ticket = { status: "in_progress" as const, promisedBy: "2026-10-13" };

  it("is not overdue during the promised-by day", () => {
    expect(isOverdue(ticket, new Date("2026-10-13T16:00:00Z"), TZ)).toBe(false);
  });

  it("is not overdue at 23:59 shop time on the promised-by day", () => {
    // 23:59 PDT on Oct 13 = 06:59 UTC on Oct 14.
    expect(isOverdue(ticket, new Date("2026-10-14T06:59:00Z"), TZ)).toBe(false);
  });

  it("becomes overdue at midnight shop time after the promised-by day", () => {
    // 00:00 PDT on Oct 14 = 07:00 UTC on Oct 14.
    expect(isOverdue(ticket, new Date("2026-10-14T07:00:00Z"), TZ)).toBe(true);
  });

  it("is never overdue once ready for pickup or picked up", () => {
    const late = new Date("2026-11-01T12:00:00Z");
    for (const status of STATUSES) {
      const expected = status !== "ready_for_pickup" && status !== "picked_up";
      expect(isOverdue({ status, promisedBy: "2026-10-13" }, late, TZ)).toBe(expected);
    }
  });
});
