import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Workspaces with tests. apps/api has its own config for the test database;
    // apps/web tests its pure helpers only; e2e/ is Playwright.
    projects: ["packages/shared", "apps/api", "apps/web"],
  },
});
