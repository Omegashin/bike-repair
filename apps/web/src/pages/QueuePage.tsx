import { STATUS_LABELS, STATUSES, type Status } from "@bike-repair/shared";
import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { getQueue, type QueueTicket } from "../api.ts";
import { ButtonLink } from "../components/Button.tsx";
import { OverdueTag, StatusBadge } from "../components/StatusBadge.tsx";
import { usePageTitle } from "../components/usePageTitle.ts";
import { formatCalendarDate } from "../format.ts";

// The queue never lists picked-up tickets, so they aren't a filter option.
const FILTER_STATUSES = STATUSES.filter((status) => status !== "picked_up");

function parseFilter(value: string | null): Status | undefined {
  return FILTER_STATUSES.find((status) => status === value);
}

type Loaded = { filter: Status | undefined } & (
  { tickets: QueueTicket[]; error?: undefined } | { tickets?: undefined; error: string }
);

// Staff landing page: open tickets, due soonest first (the API's order).
export function QueuePage() {
  usePageTitle("Repair queue");
  const [searchParams, setSearchParams] = useSearchParams();
  // In the URL, so a filtered queue survives a reload and the back button.
  const filter = parseFilter(searchParams.get("status"));
  const [loaded, setLoaded] = useState<Loaded>();

  useEffect(() => {
    let current = true;
    getQueue(filter)
      .then((tickets) => current && setLoaded({ filter, tickets }))
      .catch((err: Error) => current && setLoaded({ filter, error: err.message }));
    return () => {
      current = false;
    };
  }, [filter]);

  const result = loaded?.filter === filter ? loaded : undefined;
  const overdueCount = result?.tickets?.filter((t) => t.overdue).length ?? 0;

  return (
    <>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Repair queue</h1>
          {result?.tickets && (
            <p className="text-gray-700" aria-live="polite">
              {result.tickets.length} {result.tickets.length === 1 ? "ticket" : "tickets"}
              {overdueCount > 0 && <>, {overdueCount} overdue</>}
            </p>
          )}
        </div>
        <div>
          <label htmlFor="status-filter" className="mb-1 block font-medium text-gray-900">
            Status
          </label>
          <select
            id="status-filter"
            className="block min-h-11 w-full rounded-md border border-gray-400 bg-white px-3 py-2 text-base sm:w-56"
            value={filter ?? ""}
            onChange={(e) => setSearchParams(e.target.value ? { status: e.target.value } : {})}
          >
            <option value="">All open tickets</option>
            {FILTER_STATUSES.map((status) => (
              <option key={status} value={status}>
                {STATUS_LABELS[status]}
              </option>
            ))}
          </select>
        </div>
      </div>

      {!result && <p className="text-gray-700">Loading tickets…</p>}
      {result?.error && (
        <p role="alert" className="rounded-md bg-red-50 p-4 font-medium text-red-800">
          Couldn't load the queue. {result.error}
        </p>
      )}
      {result?.tickets?.length === 0 && <EmptyQueue filter={filter} />}
      {result?.tickets && result.tickets.length > 0 && <TicketList tickets={result.tickets} />}
    </>
  );
}

function TicketList({ tickets }: { tickets: QueueTicket[] }) {
  return (
    <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
      {/* Column headings for wide screens; on phones each row is a labelled card. */}
      <div
        aria-hidden="true"
        className="hidden grid-cols-[7rem_1fr_1.4fr_11rem_12rem] gap-4 border-b border-gray-200 bg-gray-50 px-4 py-2 text-sm font-semibold text-gray-700 md:grid"
      >
        <span>Ticket</span>
        <span>Customer</span>
        <span>Bike</span>
        <span>Status</span>
        <span>Promised by</span>
      </div>
      <ul className="divide-y divide-gray-200">
        {tickets.map((ticket) => (
          <li key={ticket.number}>
            <Link
              to={`/tickets/${ticket.number}`}
              className={`block border-l-4 px-4 py-3 hover:bg-gray-50 md:grid md:grid-cols-[7rem_1fr_1.4fr_11rem_12rem] md:items-center md:gap-4 ${
                ticket.overdue ? "border-red-700 bg-red-50/60" : "border-transparent"
              }`}
            >
              <span className="font-mono text-lg font-bold tracking-wider text-gray-900">
                {ticket.number}
              </span>
              <span className="block font-medium text-gray-900">{ticket.customerName}</span>
              <span className="block text-gray-700">{ticket.bikeDescription}</span>
              <span className="mt-2 block md:mt-0">
                <StatusBadge status={ticket.status} />
              </span>
              <span className="mt-2 flex flex-wrap items-center gap-2 md:mt-0">
                <span className={ticket.overdue ? "font-semibold text-red-800" : "text-gray-800"}>
                  <span className="md:sr-only">Promised by </span>
                  {formatCalendarDate(ticket.promisedBy)}
                </span>
                {ticket.overdue && <OverdueTag />}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function EmptyQueue({ filter }: { filter: Status | undefined }) {
  return (
    <div className="rounded-lg border border-dashed border-gray-300 bg-white p-8 text-center">
      {filter ? (
        <>
          <p className="mb-4 text-lg text-gray-800">
            No open tickets with the status “{STATUS_LABELS[filter]}”.
          </p>
          <ButtonLink to="/" variant="secondary">
            Show all open tickets
          </ButtonLink>
        </>
      ) : (
        <>
          <p className="mb-4 text-lg text-gray-800">No bikes in the queue right now.</p>
          <ButtonLink to="/tickets/new">New ticket</ButtonLink>
        </>
      )}
    </div>
  );
}
