import { loginSchema } from "@bike-repair/shared";
import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router";
import { ApiError, issuesToFieldErrors, logIn, type FieldErrors } from "../api.ts";
import { Button } from "../components/Button.tsx";
import { Field } from "../components/Field.tsx";
import { SHOP_NAME, usePageTitle } from "../components/usePageTitle.ts";

export function LoginPage() {
  usePageTitle("Staff login");
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const parsed = loginSchema.safeParse({ password });
    if (!parsed.success) {
      setErrors(issuesToFieldErrors(parsed.error.issues));
      return;
    }
    setSubmitting(true);
    try {
      await logIn(parsed.data.password);
      navigate("/", { replace: true });
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setErrors({ password: "That password isn't right. Try again." });
      } else if (err instanceof ApiError && Object.keys(err.fieldErrors).length > 0) {
        setErrors(err.fieldErrors);
      } else {
        setErrors({ password: err instanceof Error ? err.message : "Couldn't log in." });
      }
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-start justify-center bg-gray-50 px-4 pt-16 sm:pt-24">
      <div className="w-full max-w-sm rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-semibold text-gray-600">{SHOP_NAME}</p>
        <h1 className="mb-6 text-2xl font-bold text-gray-900">Staff login</h1>
        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          <Field
            label="Shop password"
            type="password"
            name="password"
            autoComplete="current-password"
            required
            autoFocus
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={errors.password}
          />
          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? "Logging in…" : "Log in"}
          </Button>
        </form>
      </div>
    </main>
  );
}
