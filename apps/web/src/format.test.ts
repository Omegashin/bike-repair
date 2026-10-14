import { afterEach, describe, expect, it, vi } from "vitest";
import { formatCalendarDate } from "./format.ts";

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
