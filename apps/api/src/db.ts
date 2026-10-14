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
