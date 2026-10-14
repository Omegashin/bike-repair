import { STATUS_LABELS, statusChangeSchema, type Status } from "@bike-repair/shared";
import { useEffect, useState, type ReactNode } from "react";
import { Link, useParams } from "react-router";
import {
  ApiError,
  changeStatus,
  getTicket,
  issuesToFieldErrors,
  type TicketDetail,
  type TicketEvent,
} from "../api.ts";
import { Button } from "../components/Button.tsx";
import { Field } from "../components/Field.tsx";
import { OverdueTag, StatusBadge } from "../components/StatusBadge.tsx";
import { useStaffContext } from "../components/staffContext.ts";
import { usePageTitle } from "../components/usePageTitle.ts";
import { formatCalendarDate, formatDateTime, formatPhone } from "../format.ts";

type Loaded = { number: string; reload: number } & (
  { ticket: TicketDetail; error?: undefined } | { ticket?: undefined; error: ApiError | Error }
);

export function TicketPage() {
  const number = useParams().number!.toUpperCase();
  usePageTitle(`Ticket ${number}`);
  const { timeZone } = useStaffContext();
  // Bumped to fetch the ticket again (after someone else changed it).
  const [reload, setReload] = useState(0);
  const [loaded, setLoaded] = useState<Loaded>();

  useEffect(() => {
    let current = true;
    getTicket(number)
      .then((ticket) => current && setLoaded({ number, reload, ticket }))
      .catch((error: Error) => current && setLoaded({ number, reload, error }));
    return () => {
      current = false;
    };
  }, [number, reload]);

  const result = loaded?.number === number && loaded.reload === reload ? loaded : undefined;
  // Keep showing the previous ticket while a reload is in flight.
  const ticket = result?.ticket ?? (loaded?.number === number ? loaded.ticket : undefined);

  if (result?.error) {
    const notFound = result.error instanceof ApiError && result.error.status === 404;
    return (
      <div className="max-w-xl">
        <h1 className="mb-2 text-2xl font-bold text-gray-900">
          {notFound ? `No ticket ${number}` : "Couldn't load the ticket"}
        </h1>
        <p className="mb-4 text-gray-700">
          {notFound ? "Check the number on the bike tag." : result.error.message}
        </p>
        <Link to="/" className="font-semibold text-blue-700 underline">
          Back to the queue
        </Link>
      </div>
    );
  }
  if (!ticket) return <p className="text-gray-700">Loading ticket…</p>;

  return (
    <div className="space-y-6">
      <Link to="/" className="inline-block font-semibold text-blue-700 underline">
        ← Queue
      </Link>
      <header className="flex flex-wrap items-center gap-3">
        <h1 className="font-mono text-3xl font-bold tracking-wider text-gray-900">
          <span className="sr-only">Ticket </span>
          {ticket.number}
        </h1>
        <StatusBadge status={ticket.status} />
        {ticket.overdue && <OverdueTag />}
      </header>

      <div className="grid gap-6 lg:grid-cols-[1fr_24rem]">
        <TicketInfo ticket={ticket} />
        <StatusChange
          ticket={ticket}
          onChanged={(updated) => setLoaded({ number, reload, ticket: updated })}
          onConflict={() => setReload((n) => n + 1)}
        />
      </div>

      <History events={ticket.history} timeZone={timeZone} />
    </div>
  );
}

function TicketInfo({ ticket }: { ticket: TicketDetail }) {
  return (
    <section
      aria-labelledby="details-heading"
      className="rounded-lg border border-gray-200 bg-white p-4 sm:p-6"
    >
      <h2 id="details-heading" className="sr-only">
        Details
      </h2>
      <dl className="grid gap-4 sm:grid-cols-2">
        <InfoItem label="Bike">{ticket.bikeDescription}</InfoItem>
        <InfoItem label="Promised by">
          <span className={ticket.overdue ? "font-semibold text-red-800" : undefined}>
            {formatCalendarDate(ticket.promisedBy)}
          </span>
        </InfoItem>
        <InfoItem label="Problem" wide>
          {ticket.problem ?? <span className="text-gray-600">Not recorded</span>}
        </InfoItem>
        <InfoItem label="Customer">{ticket.customer.name}</InfoItem>
        <InfoItem label="Phone">
          <a href={`tel:${ticket.customer.phone}`} className="text-blue-700 underline">
            {formatPhone(ticket.customer.phone)}
          </a>
        </InfoItem>
      </dl>
    </section>
  );
}

function InfoItem({
  label,
  wide,
  children,
}: {
  label: string;
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={wide ? "sm:col-span-2" : undefined}>
      <dt className="text-sm font-semibold text-gray-600">{label}</dt>
      <dd className="text-lg whitespace-pre-line text-gray-900">{children}</dd>
    </div>
  );
}

type StatusChangeProps = {
  ticket: TicketDetail;
  onChanged: (ticket: TicketDetail) => void;
  onConflict: () => void;
};

// One button per status the API says this ticket can move to; none once picked up.
function StatusChange({ ticket, onChanged, onConflict }: StatusChangeProps) {
  const [note, setNote] = useState("");
  const [noteError, setNoteError] = useState<string>();
  const [message, setMessage] = useState<{ kind: "error" | "done"; text: string }>();
  const [pending, setPending] = useState<Status>();

  async function move(to: Status) {
    setMessage(undefined);
    const parsed = statusChangeSchema.safeParse({ to, note });
    if (!parsed.success) {
      setNoteError(issuesToFieldErrors(parsed.error.issues).note);
      return;
    }
    setPending(to);
    try {
      const updated = await changeStatus(ticket.number, parsed.data);
      onChanged(updated);
      setNote("");
      setMessage({ kind: "done", text: `Moved to ${STATUS_LABELS[updated.status]}.` });
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        // Someone else moved it first: show what it is now. The note is kept to retry.
        setMessage({
          kind: "error",
          text: "This ticket was changed by someone else before your update was saved. It has been reloaded; check its status and try again.",
        });
        onConflict();
      } else if (err instanceof ApiError && err.fieldErrors.note) {
        setNoteError(err.fieldErrors.note);
      } else {
        setMessage({ kind: "error", text: err instanceof Error ? err.message : "Update failed." });
      }
    } finally {
      setPending(undefined);
    }
  }

  return (
    <section
      aria-labelledby="status-heading"
      className="rounded-lg border border-gray-200 bg-white p-4 sm:p-6"
    >
      <h2 id="status-heading" className="mb-3 text-lg font-bold text-gray-900">
        Update status
      </h2>
      {ticket.nextStatuses.length === 0 ? (
        <p className="text-gray-700">This bike has been picked up. The ticket is closed.</p>
      ) : (
        <div className="space-y-4">
          <Field
            label="Note for staff"
            hint="Internal only; customers never see it."
            name="note"
            multiline
            value={note}
            onChange={(e) => {
              setNote(e.target.value);
              setNoteError(undefined);
            }}
            error={noteError}
          />
          <div className="flex flex-col gap-2">
            {ticket.nextStatuses.map((status) => (
              <Button
                key={status}
                onClick={() => move(status)}
                disabled={pending !== undefined}
                // Waiting on parts is a step back, so it doesn't look like the main action.
                variant={status === "waiting_on_parts" ? "secondary" : "primary"}
              >
                {pending === status ? "Saving…" : `Move to ${STATUS_LABELS[status]}`}
              </Button>
            ))}
          </div>
        </div>
      )}
      <p
        role={message?.kind === "error" ? "alert" : "status"}
        className={`mt-3 rounded-md p-3 font-medium empty:hidden ${
          message?.kind === "error" ? "bg-red-50 text-red-800" : "bg-green-50 text-green-900"
        }`}
      >
        {message?.text}
      </p>
    </section>
  );
}

function History({ events, timeZone }: { events: TicketEvent[]; timeZone: string | undefined }) {
  return (
    <section aria-labelledby="history-heading">
      <h2 id="history-heading" className="mb-3 text-lg font-bold text-gray-900">
        History
      </h2>
      <ol className="space-y-3">
        {events.map((event, i) => (
          <li key={i} className="rounded-lg border border-gray-200 bg-white p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <p className="font-semibold text-gray-900">
                {event.from === null
                  ? `Ticket created · ${STATUS_LABELS[event.to]}`
                  : `${STATUS_LABELS[event.from]} → ${STATUS_LABELS[event.to]}`}
              </p>
              <time dateTime={event.createdAt} className="text-sm text-gray-600">
                {formatDateTime(event.createdAt, timeZone)}
              </time>
            </div>
            {event.note && (
              <p className="mt-2 border-l-4 border-gray-300 pl-3 whitespace-pre-line text-gray-800">
                <span className="sr-only">Note: </span>
                {event.note}
              </p>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}
