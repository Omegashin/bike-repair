import { expect, test } from "@playwright/test";

test("web app loads", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Staff login" })).toBeVisible();
});

test("web dev server proxies /api to the API", async ({ request }) => {
  const res = await request.get("/api/health");
  expect(res.ok()).toBe(true);
  expect(await res.json()).toEqual({ ok: true });
});

// The v1 acceptance path from decisions.md. Implement once intake, status changes
// and the lookup page exist, then remove .fixme.
test.fixme("intake → ready for pickup → customer lookup", async () => {
  // 1. Staff: create a ticket (name, phone, bike, problem, promised-by); note the ticket number.
  // 2. Staff: move it received → diagnosing → in_progress → ready_for_pickup, adding an internal note.
  // 3. Queue: the ticket shows "Ready for pickup" and is not highlighted as overdue.
  // 4. Customer (mobile): look up ticket number + last 4 phone digits → sees
  //    CUSTOMER_STATUS_TEXT.ready_for_pickup and the promised-by date, and NOT the internal note.
  // 5. Customer: wrong last 4 digits → same "not found" message as an unknown ticket number.
});
