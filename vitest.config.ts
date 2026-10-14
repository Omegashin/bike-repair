import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Workspaces with tests. apps/api has its own config for the test database; e2e/ is Playwright.
    projects: ["packages/shared", "apps/api"],
  },
});
