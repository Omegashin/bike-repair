// Display formatting shared by the staff and customer screens.

const calendarDate = new Intl.DateTimeFormat("en-US", {
  // The date is built at UTC midnight below, so format it in UTC too: the browser's
  // zone never shifts it to the day before (as new Date("2026-10-14") would).
  timeZone: "UTC",
  weekday: "short",
  month: "short",
  day: "numeric",
  year: "numeric",
});

// A YYYY-MM-DD calendar date (promisedBy) for display, e.g. "Wed, Oct 14, 2026".
export function formatCalendarDate(date: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) throw new Error(`Expected a YYYY-MM-DD date, got "${date}"`);
  const [, year, month, day] = match.map(Number);
  return calendarDate.format(new Date(Date.UTC(year, month - 1, day)));
}

// A moment (e.g. a history event's createdAt) in the shop's time zone, e.g.
// "Oct 14, 2026, 3:05 PM". Without a zone, falls back to the browser's.
export function formatDateTime(iso: string, timeZone: string | undefined): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

// Stored phones are digits only. North American numbers get the usual grouping;
// anything else is shown as stored.
export function formatPhone(digits: string): string {
  const match = /^1?(\d{3})(\d{3})(\d{4})$/.exec(digits);
  return match ? `(${match[1]}) ${match[2]}-${match[3]}` : digits;
}
