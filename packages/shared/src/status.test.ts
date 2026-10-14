import { describe, expect, it } from "vitest";
import { STATUSES, canTransition, nextStatuses, type Status } from "./status.ts";

// The status table from decisions.md, written out independently of status.ts.
// If a rule changes, change it here first, deliberately: this is the spec.
const SPEC: Record<Status, Status[]> = {
  received: ["diagnosing"],
  diagnosing: ["waiting_on_parts", "in_progress"],
  waiting_on_parts: ["in_progress"],
  in_progress: ["waiting_on_parts", "ready_for_pickup"],
  ready_for_pickup: ["picked_up"],
  picked_up: [],
};

describe("status transitions", () => {
  it.each(STATUSES)("from %s allows exactly the moves in the spec", (from) => {
    expect([...nextStatuses(from)].sort()).toEqual([...SPEC[from]].sort());
    for (const to of STATUSES) {
      expect(canTransition(from, to), `${from} → ${to}`).toBe(SPEC[from].includes(to));
    }
  });

  it("lets every ticket eventually reach picked_up", () => {
    for (const start of STATUSES) {
      const seen = new Set<Status>([start]);
      const queue: Status[] = [start];
      while (queue.length) {
        for (const next of nextStatuses(queue.shift()!)) {
          if (!seen.has(next)) {
            seen.add(next);
            queue.push(next);
          }
        }
      }
      expect(seen.has("picked_up"), `stuck starting from ${start}`).toBe(true);
    }
  });
});
