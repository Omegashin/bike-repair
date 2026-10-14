import { createIntakeSchema, shopToday, type IntakeInput } from "@bike-repair/shared";
import { useRef, useState, type FormEvent } from "react";
import {
  ApiError,
  createTicket,
  issuesToFieldErrors,
  type FieldErrors,
  type Ticket,
} from "../api.ts";
import { Button, ButtonLink } from "../components/Button.tsx";
import { Field } from "../components/Field.tsx";
import { useStaffContext } from "../components/staffContext.ts";
import { usePageTitle } from "../components/usePageTitle.ts";
import { formatCalendarDate } from "../format.ts";

const EMPTY: Required<IntakeInput> = {
  customerName: "",
  phone: "",
  bikeDescription: "",
  problem: "",
  promisedBy: "",
};

export function IntakePage() {
  usePageTitle("New ticket");
  const { timeZone } = useStaffContext();
  const [values, setValues] = useState(EMPTY);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string>();
  const [submitting, setSubmitting] = useState(false);
  const [created, setCreated] = useState<Ticket>();
  const formRef = useRef<HTMLFormElement>(null);

  // The shop's date, not the browser's. If the time zone is unknown (API unreachable
  // at load), skip the past-date check here; the API still enforces it.
  const today = timeZone ? shopToday(new Date(), timeZone) : "";

  function update(field: keyof IntakeInput, value: string) {
    setValues((v) => ({ ...v, [field]: value }));
    setErrors((e) => {
      const rest = { ...e };
      delete rest[field];
      return rest;
    });
  }

  function showErrors(fieldErrors: FieldErrors) {
    setErrors(fieldErrors);
    // After React renders the errors, move to the first field that needs fixing.
    requestAnimationFrame(() =>
      formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(),
    );
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(undefined);
    const parsed = createIntakeSchema(today).safeParse(values);
    if (!parsed.success) {
      showErrors(issuesToFieldErrors(parsed.error.issues));
      return;
    }
    setSubmitting(true);
    try {
      setCreated(await createTicket(parsed.data));
    } catch (err) {
      if (err instanceof ApiError && Object.keys(err.fieldErrors).length > 0) {
        showErrors(err.fieldErrors);
      } else {
        setFormError(err instanceof Error ? err.message : "Couldn't create the ticket.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  function startAnother() {
    setValues(EMPTY);
    setErrors({});
    setCreated(undefined);
  }

  if (created) return <Created ticket={created} onAnother={startAnother} />;

  return (
    <div className="max-w-2xl">
      <h1 className="mb-1 text-2xl font-bold text-gray-900">New ticket</h1>
      <p className="mb-6 text-gray-700">
        Fields marked{" "}
        <span className="text-red-700" aria-hidden="true">
          *
        </span>
        <span className="sr-only">as required</span> are required.
      </p>
      <form
        ref={formRef}
        onSubmit={handleSubmit}
        noValidate
        className="space-y-5 rounded-lg border border-gray-200 bg-white p-4 sm:p-6"
      >
        <div className="grid gap-5 sm:grid-cols-2">
          <Field
            label="Customer name"
            name="customerName"
            autoComplete="off"
            autoFocus
            required
            value={values.customerName}
            onChange={(e) => update("customerName", e.target.value)}
            error={errors.customerName}
          />
          <Field
            label="Phone"
            name="phone"
            type="tel"
            inputMode="tel"
            autoComplete="off"
            hint="Customers check status with the last 4 digits."
            required
            value={values.phone}
            onChange={(e) => update("phone", e.target.value)}
            error={errors.phone}
          />
        </div>
        <Field
          label="Bike"
          name="bikeDescription"
          hint="Colour, make and model, e.g. Blue Trek FX 2 hybrid"
          autoComplete="off"
          required
          value={values.bikeDescription}
          onChange={(e) => update("bikeDescription", e.target.value)}
          error={errors.bikeDescription}
        />
        <Field
          label="Problem"
          name="problem"
          multiline
          value={values.problem}
          onChange={(e) => update("problem", e.target.value)}
          error={errors.problem}
        />
        <Field
          label="Promised by"
          name="promisedBy"
          type="date"
          min={today || undefined}
          required
          className="sm:w-56"
          value={values.promisedBy}
          onChange={(e) => update("promisedBy", e.target.value)}
          error={errors.promisedBy}
        />
        {formError && (
          <p role="alert" className="rounded-md bg-red-50 p-3 font-medium text-red-800">
            {formError}
          </p>
        )}
        <Button type="submit" className="w-full sm:w-auto" disabled={submitting}>
          {submitting ? "Creating…" : "Create ticket"}
        </Button>
      </form>
    </div>
  );
}

function Created({ ticket, onAnother }: { ticket: Ticket; onAnother: () => void }) {
  return (
    <section
      aria-labelledby="created-heading"
      className="max-w-2xl rounded-lg border border-green-300 bg-white p-6 text-center"
    >
      <h1
        id="created-heading"
        tabIndex={-1}
        ref={(heading) => heading?.focus()}
        className="text-2xl font-bold text-gray-900"
      >
        Ticket created
      </h1>
      <p className="mt-4 text-gray-700">Write this number on the bike tag:</p>
      <p className="my-3 font-mono text-6xl font-bold tracking-[0.2em] text-gray-900 select-all sm:text-7xl">
        {ticket.number}
      </p>
      <p className="text-gray-700">
        {ticket.customer.name} · {ticket.bikeDescription}
        <br />
        Promised by {formatCalendarDate(ticket.promisedBy)}
      </p>
      <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
        <ButtonLink to={`/tickets/${ticket.number}`}>Open ticket</ButtonLink>
        <Button variant="secondary" onClick={onAnother}>
          Create another
        </Button>
      </div>
    </section>
  );
}
