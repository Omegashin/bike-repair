import { existsSync } from "node:fs";
import path from "node:path";
import { defineConfig } from "prisma/config";

// One .env at the repo root serves Prisma, the API and Docker Compose.
// Variables already set (e.g. by Compose or the test setup) take precedence.
const envFile = path.resolve(import.meta.dirname, "../../.env");
if (existsSync(envFile)) process.loadEnvFile(envFile);

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "node --env-file-if-exists=../../.env prisma/seed.ts",
  },
  datasource: {
    url: process.env["DATABASE_URL"],
  },
});
