import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/prisma/client.ts";

export const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

// Prisma returns @db.Date columns as UTC-midnight Dates; the app works in YYYY-MM-DD.
export function toDateString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function fromDateString(date: string): Date {
  return new Date(`${date}T00:00:00Z`);
}

// IANA zone that decides the shop's calendar date (overdue, promised-by checks).
// Required: createApp reads it once, so a missing or mistyped zone fails at startup.
export function shopTimeZone(): string {
  const value = process.env.SHOP_TIME_ZONE;
  if (!value) {
    throw new Error("SHOP_TIME_ZONE must be set, e.g. America/Vancouver (see .env.example)");
  }
  try {
    new Intl.DateTimeFormat("en-CA", { timeZone: value });
  } catch {
    throw new Error(`SHOP_TIME_ZONE "${value}" is not a valid IANA time zone`);
  }
  return value;
}
