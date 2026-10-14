import { z } from "zod";
import { STATUSES } from "./status.ts";

// Request bodies, validated by the API and reused by the web forms.

export const loginSchema = z.object({
  password: z.string().min(1, "Enter the shop password"),
});

export type LoginInput = z.infer<typeof loginSchema>;

// Free text: trimmed, and blank counts as missing.
function requiredText(message: string, max: number) {
  return z.string(message).trim().min(1, message).max(max);
}

// Any formatting is accepted; only the digits are kept.
const phone = z
  .string("Enter the customer's phone number")
  .transform((value) => value.replace(/\D/g, ""))
  .pipe(z.string().regex(/^\d{10,15}$/, "Enter a phone number with 10 to 15 digits"));

// `today` is the shop's calendar date (YYYY-MM-DD, from shopToday), so the
// earliest promised-by date follows the shop's time zone, not the browser's or UTC.
export function createIntakeSchema(today: string) {
  return z.object({
    customerName: requiredText("Enter the customer's name", 100),
    phone,
    bikeDescription: requiredText("Describe the bike", 200),
    problem: z
      .string()
      .trim()
      .max(1000)
      .optional()
      .transform((value) => value || undefined),
    promisedBy: z.iso
      .date({ error: "Choose a promised-by date", abort: true })
      .refine((date) => date >= today, "Promised-by date can't be in the past"),
  });
}

export type IntakeInput = z.input<ReturnType<typeof createIntakeSchema>>;

// Query string for the staff queue (GET /api/tickets).
export const queueQuerySchema = z.object({
  status: z.enum(STATUSES, "Unknown status").optional(),
});

export type QueueQuery = z.infer<typeof queueQuerySchema>;

// Moving a ticket to another status (POST /api/tickets/:number/status). Whether the
// move is allowed is checked against status.ts by the API, not here.
export const statusChangeSchema = z.object({
  to: z.enum(STATUSES, "Choose a status"),
  // Internal only; never shown to the customer.
  note: z
    .string()
    .trim()
    .max(500, "Keep the note to 500 characters")
    .optional()
    .transform((value) => value || undefined),
});

export type StatusChangeInput = z.input<typeof statusChangeSchema>;
