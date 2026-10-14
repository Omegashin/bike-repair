import { CUSTOMER_STATUS_TEXT, shopToday, TICKET_NUMBER_PATTERN } from "@bike-repair/shared";
import { devices, expect, test } from "@playwright/test";
import { formatCalendarDate } from "../apps/web/src/format.ts";
import { E2E_STAFF_PASSWORD } from "./playwright.config.ts";

// The shop's zone, as set for the e2e API in playwright.config.ts.
const SHOP_TIME_ZONE = "America/Vancouver";

function daysFromShopToday(days: number): string {
  const date = new Date(`${shopToday(new Date(), SHOP_TIME_ZONE)}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

// The v1 acceptance path from decisions.md.
test("intake → ready for pickup → customer lookup", async ({ page, browser }, testInfo) => {
  // A fresh phone each run: the e2e database is kept between runs, and a reused
  // phone would attach the ticket to an earlier run's customer.
  const last4 = String(Math.floor(Math.random() * 10000)).padStart(4, "0");
  const wrongLast4 = String((Number(last4) + 1) % 10000).padStart(4, "0");
  const customerName = "Robin E2E";
  const promisedBy = daysFromShopToday(2);
  const note = `Internal: trued rear wheel, customer owes $45 (${last4})`;

  // 1. Staff: log in and create a ticket; note the ticket number.
  await page.goto("/login");
  await page.getByLabel("Shop password").fill(E2E_STAFF_PASSWORD);
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page.getByRole("heading", { name: "Repair queue" })).toBeVisible();

  await page.getByRole("link", { name: "New ticket" }).click();
  await page.getByLabel("Customer name").fill(customerName);
  await page.getByLabel("Phone").fill(`(604) 555-${last4}`);
  await page.getByLabel("Bike").fill("Teal Marin Larkspur");
  await page.getByLabel("Problem").fill("Rear wheel wobbles");
  await page.getByLabel("Promised by").fill(promisedBy);
  await page.getByRole("button", { name: "Create ticket" }).click();

  await expect(page.getByRole("heading", { name: "Ticket created" })).toBeVisible();
  const ticketNumber = await page.getByText(TICKET_NUMBER_PATTERN).textContent();
  expect(ticketNumber).toMatch(TICKET_NUMBER_PATTERN);

  // 2. Staff: received → diagnosing → in progress → ready for pickup, with an internal note.
  await page.getByRole("link", { name: "Open ticket" }).click();
  await expect(page.getByRole("heading", { name: `Ticket ${ticketNumber}` })).toBeVisible();
  for (const label of ["Diagnosing", "In progress"]) {
    await page.getByRole("button", { name: `Move to ${label}` }).click();
    await expect(page.getByText(`Moved to ${label}.`)).toBeVisible();
  }
  await page.getByLabel("Note for staff").fill(note);
  await page.getByRole("button", { name: "Move to Ready for pickup" }).click();
  await expect(page.getByText("Moved to Ready for pickup.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Move to Picked up" })).toBeVisible();
  await expect(page.getByRole("region", { name: "History" })).toContainText(note);

  // 3. Queue: the ticket shows "Ready for pickup" and is not highlighted as overdue.
  await page.getByRole("link", { name: "← Queue" }).click();
  const row = page.getByRole("link", { name: new RegExp(ticketNumber!) });
  await expect(row).toContainText("Ready for pickup");
  await expect(row).toContainText(customerName);
  await expect(row).not.toContainText("Overdue");

  // 4. Customer, on a phone: sees the ready text and promised-by date, not the note.
  const customer = await browser.newContext({
    ...devices["Pixel 7"],
    baseURL: testInfo.project.use.baseURL,
  });
  const phone = await customer.newPage();
  await phone.goto("/status");
  await expect(phone.getByRole("link")).toHaveCount(0);
  await phone.getByLabel("Ticket number").fill(ticketNumber!.toLowerCase());
  await phone.getByLabel("Last 4 digits of your phone number").fill(last4);
  await phone.getByRole("button", { name: "Check status" }).click();

  await expect(phone.getByText(CUSTOMER_STATUS_TEXT.ready_for_pickup)).toBeVisible();
  await expect(phone.getByText(formatCalendarDate(promisedBy))).toBeVisible();
  await expect(phone.locator("body")).not.toContainText(note);
  await expect(phone.locator("body")).not.toContainText(customerName);

  // 5. Customer: wrong last 4 digits → the same "not found" message as an unknown ticket.
  await phone.getByRole("button", { name: "Check another ticket" }).click();
  await phone.getByLabel("Ticket number").fill(ticketNumber!);
  await phone.getByLabel("Last 4 digits of your phone number").fill(wrongLast4);
  const [wrongDigitsResponse] = await Promise.all([
    phone.waitForResponse("**/api/lookup"),
    phone.getByRole("button", { name: "Check status" }).click(),
  ]);
  expect(wrongDigitsResponse.status()).toBe(404);
  const wrongDigits = phone.getByRole("alert").filter({ hasText: "couldn't find" });
  await expect(wrongDigits).toBeVisible();
  const wrongDigitsMessage = await wrongDigits.textContent();
  await expect(phone.getByText(CUSTOMER_STATUS_TEXT.ready_for_pickup)).toHaveCount(0);

  // A well-formed number that no ticket has (this one, with its last character changed).
  const unknownNumber = ticketNumber!.slice(0, 5) + (ticketNumber!.endsWith("Z") ? "Y" : "Z");
  await phone.getByLabel("Ticket number").fill(unknownNumber);
  await phone.getByLabel("Last 4 digits of your phone number").fill(last4);
  const [unknownResponse] = await Promise.all([
    phone.waitForResponse("**/api/lookup"),
    phone.getByRole("button", { name: "Check status" }).click(),
  ]);
  expect(unknownResponse.status()).toBe(404);
  expect(await unknownResponse.json()).toEqual(await wrongDigitsResponse.json());
  await expect(wrongDigits).toHaveText(wrongDigitsMessage!);

  await customer.close();
});
