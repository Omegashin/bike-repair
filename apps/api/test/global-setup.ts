import { execFileSync } from "node:child_process";
import path from "node:path";

// Bring the test database up to the latest migration once per test run.
// Non-destructive: tests clean up after themselves with resetDb().
export default function setup() {
  let failure: string | undefined;
  try {
    execFileSync("npx", ["prisma", "migrate", "deploy"], {
      cwd: path.resolve(import.meta.dirname, ".."),
      env: { ...process.env, DATABASE_URL: process.env.TEST_DATABASE_URL },
      stdio: "pipe",
    });
  } catch (err) {
    // Keep only Prisma's text; the raw error carries Buffers that bury the message.
    const { stdout = "", stderr = "" } = err as { stdout?: Buffer; stderr?: Buffer };
    failure = `${stdout}${stderr}`.trim();
  }

  if (failure === undefined) return;
  if (/P1001|Can't reach database|ECONNREFUSED/i.test(failure)) {
    throw new Error("Postgres isn't reachable. Start it with: npm run db:up");
  }
  throw new Error(`Migrating the test database failed:\n${failure}`);
}
