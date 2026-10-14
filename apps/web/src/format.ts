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
