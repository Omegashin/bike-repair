import { afterEach, describe, expect, it, vi } from "vitest";
import { formatCalendarDate, formatDateTime, formatPhone } from "./format.ts";

describe("formatCalendarDate", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("formats a calendar date with its weekday", () => {
    expect(formatCalendarDate("2026-10-14")).toBe("Wed, Oct 14, 2026");
  });

  it("keeps the same day in a browser west of UTC", () => {
    // new Date("2026-10-14") is UTC midnight, which is still Oct 13 in Vancouver.
    vi.stubEnv("TZ", "America/Vancouver");
    expect(new Date("2026-10-14").getDate()).toBe(13);
    expect(formatCalendarDate("2026-10-14")).toBe("Wed, Oct 14, 2026");
  });

  it("keeps the same day in a browser east of UTC", () => {
    vi.stubEnv("TZ", "Pacific/Kiritimati");
    expect(formatCalendarDate("2026-12-31")).toBe("Thu, Dec 31, 2026");
  });

  it("rejects anything but YYYY-MM-DD", () => {
    expect(() => formatCalendarDate("2026-10-14T00:00:00Z")).toThrow("YYYY-MM-DD");
    expect(() => formatCalendarDate("Oct 14")).toThrow("YYYY-MM-DD");
  });
});

describe("formatDateTime", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("shows the time in the shop's zone, whatever the browser's", () => {
    vi.stubEnv("TZ", "Asia/Tokyo");
    // 06:30 UTC on Oct 15 is still Oct 14 in Vancouver.
    expect(formatDateTime("2026-10-15T06:30:00.000Z", "America/Vancouver")).toBe(
      "Oct 14, 2026, 11:30 PM",
    );
  });
});

describe("formatPhone", () => {
  it("groups a 10-digit number", () => {
    expect(formatPhone("6045550142")).toBe("(604) 555-0142");
  });

  it("drops a leading country code 1", () => {
    expect(formatPhone("16045550142")).toBe("(604) 555-0142");
  });

  it("leaves other numbers as stored", () => {
    expect(formatPhone("447700900123")).toBe("447700900123");
  });
});
