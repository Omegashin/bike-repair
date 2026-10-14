import { defineConfig, devices } from "@playwright/test";
import { existsSync } from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const envFile = path.join(root, ".env");
if (existsSync(envFile)) process.loadEnvFile(envFile);

// Dedicated ports and database so e2e never touches the dev stack or its data.
const API_PORT = 3100;
const WEB_PORT = 5199;
const databaseUrl = process.env.E2E_DATABASE_URL;
if (!databaseUrl) throw new Error("E2E_DATABASE_URL must be set (see .env.example)");
// Fixed staff login so e2e doesn't depend on the developer's .env.
export const E2E_STAFF_PASSWORD = "e2e-staff-password";

export default defineConfig({
  testDir: ".",
  outputDir: "test-results",
  reporter: [["list"], ["html", { outputFolder: "playwright-report", open: "never" }]],
  fullyParallel: false,
  use: {
    baseURL: `http://localhost:${WEB_PORT}`,
    trace: "retain-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    // Customers check status on their phones.
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  webServer: [
    {
      command: `npx prisma migrate deploy && node src/index.ts`,
      cwd: path.join(root, "apps/api"),
      env: {
        DATABASE_URL: databaseUrl,
        PORT: String(API_PORT),
        STAFF_PASSWORD: E2E_STAFF_PASSWORD,
        SESSION_SECRET: "e2e-session-secret-at-least-32-chars",
        SHOP_TIME_ZONE: "America/Vancouver",
      },
      url: `http://localhost:${API_PORT}/api/health`,
      reuseExistingServer: true,
      timeout: 60_000,
    },
    {
      command: `npx vite --port ${WEB_PORT} --strictPort`,
      cwd: path.join(root, "apps/web"),
      env: { API_PROXY_TARGET: `http://localhost:${API_PORT}` },
      url: `http://localhost:${WEB_PORT}`,
      reuseExistingServer: true,
      timeout: 60_000,
    },
  ],
});
