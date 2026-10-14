import type { Status } from "./status.ts";

const DONE: readonly Status[] = ["ready_for_pickup", "picked_up"];

// Today's calendar date in the shop's time zone, as YYYY-MM-DD.
export function shopToday(now: Date, timeZone: string): string {
  // en-CA formats dates as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", { timeZone }).format(now);
}

// A ticket is overdue once its promised-by day has ended in the shop's time zone
// and the bike isn't ready or collected. `promisedBy` is a YYYY-MM-DD calendar date.
export function isOverdue(
  ticket: { status: Status; promisedBy: string },
  now: Date,
  timeZone: string,
): boolean {
  if (DONE.includes(ticket.status)) return false;
  return shopToday(now, timeZone) > ticket.promisedBy;
}
