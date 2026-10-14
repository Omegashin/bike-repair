import { describe, expect, it } from "vitest";
import { generateTicketNumber, TICKET_NUMBER_PATTERN } from "./ticketNumber.ts";

describe("generateTicketNumber", () => {
  it("is 6 uppercase letters and digits without look-alikes (0/O, 1/I/L)", () => {
    for (let i = 0; i < 1000; i++) {
      const number = generateTicketNumber();
      expect(number).toMatch(/^[A-Z2-9]{6}$/);
      expect(number).not.toMatch(/[01OIL]/);
      expect(number).toMatch(TICKET_NUMBER_PATTERN);
    }
  });

  it("varies between calls", () => {
    const numbers = new Set(Array.from({ length: 100 }, generateTicketNumber));
    expect(numbers.size).toBeGreaterThan(95);
  });
});
