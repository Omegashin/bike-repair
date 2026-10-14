import { existsSync } from "node:fs";
import path from "node:path";
import { defineProject } from "vitest/config";

// Load the root .env, then point the tests at the test database.
const envFile = path.resolve(import.meta.dirname, "../../.env");
if (existsSync(envFile)) process.loadEnvFile(envFile);

const testUrl = process.env.TEST_DATABASE_URL;
if (!testUrl || !new URL(testUrl).pathname.includes("test")) {
  throw new Error(
    "TEST_DATABASE_URL must be set (see .env.example) and name a database containing 'test'. " +
      "Integration tests wipe it on every run.",
  );
}

export default defineProject({
  test: {
    name: "api",
    include: ["src/**/*.test.ts"],
    globalSetup: ["./test/global-setup.ts"],
    env: { DATABASE_URL: testUrl },
    // Tests share one database, so run files one at a time.
    fileParallelism: false,
  },
});
