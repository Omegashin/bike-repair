import { prisma } from "../src/db.ts";

// Empty every table. Call in beforeEach for tests that write to the database.
export async function resetDb() {
  const dbName = new URL(process.env.DATABASE_URL ?? "").pathname;
  if (!dbName.includes("test")) {
    throw new Error(`resetDb refused: ${dbName} is not a test database`);
  }
  await prisma.$executeRawUnsafe(
    'TRUNCATE "TicketEvent", "Ticket", "Customer" RESTART IDENTITY CASCADE',
  );
}
