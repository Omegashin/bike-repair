import { z } from "zod";

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
