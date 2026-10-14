import { z } from "zod";

// Request bodies, validated by the API and reused by the web forms.

export const loginSchema = z.object({
  password: z.string().min(1, "Enter the shop password"),
});

export type LoginInput = z.infer<typeof loginSchema>;
