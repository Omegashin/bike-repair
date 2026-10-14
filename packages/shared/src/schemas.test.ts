import { describe, expect, it } from "vitest";
import { createIntakeSchema, lookupSchema, statusChangeSchema } from "./schemas.ts";

const TODAY = "2026-10-14";
const schema = createIntakeSchema(TODAY);

const valid = {
  customerName: "Maya Chen",
  phone: "604-555-0142",
  bikeDescription: "Blue Trek FX 2 hybrid",
  problem: "Rear brake rubbing",
  promisedBy: "2026-10-17",
};

function fieldErrors(input: unknown) {
  const result = schema.safeParse(input);
  expect(result.success).toBe(false);
  return result.error!.issues.map((i) => i.path.join("."));
}

describe("intake schema", () => {
  it("accepts a complete ticket", () => {
    expect(schema.parse(valid)).toEqual({ ...valid, phone: "6045550142" });
  });

  it("requires name, phone, bike and promised-by date", () => {
    expect(fieldErrors({}).sort()).toEqual(
      ["bikeDescription", "customerName", "phone", "promisedBy"].sort(),
    );
  });

  it("rejects blank text fields", () => {
    expect(fieldErrors({ ...valid, customerName: "  ", bikeDescription: "" })).toEqual([
      "customerName",
      "bikeDescription",
    ]);
  });

  it("trims text fields", () => {
    expect(schema.parse({ ...valid, customerName: "  Maya Chen " }).customerName).toBe("Maya Chen");
  });

  it("makes the problem description optional", () => {
    const withoutProblem = { ...valid, problem: undefined };
    expect(schema.parse(withoutProblem).problem).toBeUndefined();
    expect(schema.parse({ ...valid, problem: "  " }).problem).toBeUndefined();
  });

  describe("phone", () => {
    it.each([
      ["(604) 555-0142", "6045550142"],
      ["+1 604.555.0142", "16045550142"],
      ["+44 20 7946 0958", "442079460958"],
    ])("stores %s as digits only", (phone, digits) => {
      expect(schema.parse({ ...valid, phone }).phone).toBe(digits);
    });

    it.each(["555-0142", "604 555 014", "1234567890123456"])(
      "rejects %s (needs 10–15 digits)",
      (phone) => {
        expect(fieldErrors({ ...valid, phone })).toEqual(["phone"]);
      },
    );
  });

  describe("promised-by date", () => {
    it("accepts today in the shop's time zone", () => {
      expect(schema.parse({ ...valid, promisedBy: TODAY }).promisedBy).toBe(TODAY);
    });

    it("accepts any future date", () => {
      expect(schema.parse({ ...valid, promisedBy: "2030-01-01" }).promisedBy).toBe("2030-01-01");
    });

    it("rejects a past date", () => {
      expect(fieldErrors({ ...valid, promisedBy: "2026-10-13" })).toEqual(["promisedBy"]);
    });

    it.each(["2026-02-30", "17/10/2026", "2026-10-17T00:00:00Z", ""])("rejects %s", (date) => {
      expect(fieldErrors({ ...valid, promisedBy: date })).toEqual(["promisedBy"]);
    });
  });
});

describe("status change schema", () => {
  it("accepts a known status with an optional note, trimmed", () => {
    expect(statusChangeSchema.parse({ to: "diagnosing", note: "  Checking brakes " })).toEqual({
      to: "diagnosing",
      note: "Checking brakes",
    });
    expect(statusChangeSchema.parse({ to: "diagnosing", note: "  " }).note).toBeUndefined();
  });

  it("rejects an unknown status and a note over 500 characters", () => {
    expect(statusChangeSchema.safeParse({ to: "lost" }).success).toBe(false);
    expect(statusChangeSchema.safeParse({ to: "diagnosing", note: "x".repeat(501) }).success).toBe(
      false,
    );
    expect(statusChangeSchema.parse({ to: "diagnosing", note: "x".repeat(500) }).note).toHaveLength(
      500,
    );
  });
});

describe("lookup schema", () => {
  it("accepts a ticket number in any case and returns it uppercase", () => {
    expect(lookupSchema.parse({ ticketNumber: " k7p2qx ", phoneLast4: "0142" })).toEqual({
      ticketNumber: "K7P2QX",
      phoneLast4: "0142",
    });
  });

  it("requires both fields", () => {
    const result = lookupSchema.safeParse({});
    expect(result.success).toBe(false);
    expect(result.error!.issues.map((i) => i.path.join(".")).sort()).toEqual([
      "phoneLast4",
      "ticketNumber",
    ]);
  });

  it.each(["K7P2Q", "K7P2QXX", "K7P2Q0", "K7P2-X", ""])("rejects ticket number %j", (number) => {
    expect(lookupSchema.safeParse({ ticketNumber: number, phoneLast4: "0142" }).success).toBe(
      false,
    );
  });

  it.each(["142", "01422", "01a2", "", 142])("rejects phone digits %j", (phoneLast4) => {
    expect(lookupSchema.safeParse({ ticketNumber: "K7P2QX", phoneLast4 }).success).toBe(false);
  });
});
