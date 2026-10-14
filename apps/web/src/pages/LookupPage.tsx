import { CUSTOMER_STATUS_TEXT, lookupSchema } from "@bike-repair/shared";
import { useState, type FormEvent } from "react";
import {
  ApiError,
  issuesToFieldErrors,
  lookUpRepair,
  type FieldErrors,
  type LookupResult,
} from "../api.ts";
import { Button } from "../components/Button.tsx";
import { Field } from "../components/Field.tsx";
import { SHOP_NAME, usePageTitle } from "../components/usePageTitle.ts";
import { formatCalendarDate } from "../format.ts";

// One message for any mismatch (unknown ticket or wrong digits), as the API intends.
const NOT_FOUND =
  "We couldn't find a repair with that ticket number and phone number. Check the number on your tag and the last 4 digits of the phone number you gave us.";
const TOO_MANY = "Too many tries, please wait a few minutes and try again.";

// Public page for customers, mobile-first. No staff navigation or links.
export function LookupPage() {
  usePageTitle("Check your repair");
  const [ticketNumber, setTicketNumber] = useState("");
  const [phoneLast4, setPhoneLast4] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string>();
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<LookupResult>();

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(undefined);
    const parsed = lookupSchema.safeParse({ ticketNumber, phoneLast4 });
    if (!parsed.success) {
      setErrors(issuesToFieldErrors(parsed.error.issues));
      return;
    }
    setErrors({});
    setSubmitting(true);
    try {
      setResult(await lookUpRepair(parsed.data));
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) setFormError(NOT_FOUND);
      else if (err instanceof ApiError && err.status === 429) setFormError(TOO_MANY);
      else if (err instanceof ApiError && Object.keys(err.fieldErrors).length > 0)
        setErrors(err.fieldErrors);
      else setFormError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  function checkAnother() {
    setResult(undefined);
    setTicketNumber("");
    setPhoneLast4("");
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="mx-auto max-w-md px-4 py-8">
        <p className="text-sm font-semibold text-gray-600">{SHOP_NAME}</p>
        <h1 className="mb-6 text-3xl font-bold text-gray-900">Check your repair</h1>

        {result ? (
          <Result result={result} onAnother={checkAnother} />
        ) : (
          <form
            onSubmit={handleSubmit}
            noValidate
            className="space-y-5 rounded-lg border border-gray-200 bg-white p-5"
          >
            <Field
              label="Ticket number"
              hint="The 6 characters on the tag on your bike."
              name="ticketNumber"
              required
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              maxLength={6}
              className="font-mono text-lg tracking-widest uppercase"
              value={ticketNumber}
              onChange={(e) => setTicketNumber(e.target.value)}
              error={errors.ticketNumber}
            />
            <Field
              label="Last 4 digits of your phone number"
              hint="The number you gave us when you dropped off your bike."
              name="phoneLast4"
              required
              inputMode="numeric"
              autoComplete="off"
              maxLength={4}
              className="font-mono text-lg tracking-widest"
              value={phoneLast4}
              onChange={(e) => setPhoneLast4(e.target.value)}
              error={errors.phoneLast4}
            />
            {formError && (
              <p role="alert" className="rounded-md bg-red-50 p-3 font-medium text-red-800">
                {formError}
              </p>
            )}
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? "Checking…" : "Check status"}
            </Button>
          </form>
        )}
      </main>
    </div>
  );
}

function Result({ result, onAnother }: { result: LookupResult; onAnother: () => void }) {
  const ready = result.status === "ready_for_pickup";
  return (
    <section aria-labelledby="result-heading" className="space-y-4">
      <div
        className={`rounded-lg border p-5 ${
          ready ? "border-green-600 bg-green-50" : "border-gray-200 bg-white"
        }`}
      >
        <h2
          id="result-heading"
          tabIndex={-1}
          ref={(heading) => heading?.focus()}
          className="text-sm font-semibold text-gray-600"
        >
          Ticket <span className="font-mono tracking-wider">{result.ticketNumber}</span>
        </h2>
        {ready && (
          <p aria-hidden="true" className="mt-3 text-5xl">
            🚲
          </p>
        )}
        <p
          className={`mt-2 font-bold ${ready ? "text-3xl text-green-900" : "text-2xl text-gray-900"}`}
        >
          {CUSTOMER_STATUS_TEXT[result.status]}
        </p>
        <p className="mt-3 text-gray-700">
          Promised by{" "}
          <span className="font-semibold text-gray-900">
            {formatCalendarDate(result.promisedBy)}
          </span>
        </p>
      </div>
      <Button variant="secondary" className="w-full" onClick={onAnother}>
        Check another ticket
      </Button>
    </section>
  );
}
