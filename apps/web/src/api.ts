// The only place the web app calls fetch. One typed function per endpoint.
import type { IntakeInput, LookupInput, Status, StatusChangeInput } from "@bike-repair/shared";

// One message per field, ready to show next to the input.
export type FieldErrors = Record<string, string>;

export class ApiError extends Error {
  readonly status: number;
  readonly fieldErrors: FieldErrors;
  readonly body: unknown;

  constructor(status: number, message: string, fieldErrors: FieldErrors = {}, body?: unknown) {
    super(message);
    this.status = status;
    this.fieldErrors = fieldErrors;
    this.body = body;
  }
}

// The API sends Zod's flattened errors (a list per field); the forms show the first.
function firstMessages(fieldErrors: unknown): FieldErrors {
  const result: FieldErrors = {};
  if (fieldErrors && typeof fieldErrors === "object") {
    for (const [field, messages] of Object.entries(fieldErrors)) {
      if (Array.isArray(messages) && typeof messages[0] === "string") result[field] = messages[0];
    }
  }
  return result;
}

// Same shape for client-side validation with the shared schemas, so a form shows
// its own errors and the API's 400 errors the same way.
export function issuesToFieldErrors(
  issues: readonly { path: readonly PropertyKey[]; message: string }[],
): FieldErrors {
  const result: FieldErrors = {};
  for (const issue of issues) {
    const field = String(issue.path[0] ?? "");
    result[field] ??= issue.message;
  }
  return result;
}

type RequestOptions = {
  method?: "GET" | "POST" | "DELETE";
  body?: unknown;
  // Staff endpoints: a 401 means the session is missing or expired, so go to the login page.
  staff?: boolean;
};

async function request<T>(path: string, { method = "GET", body, staff }: RequestOptions = {}) {
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      method,
      credentials: "include",
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, "Can't reach the server. Check your connection and try again.");
  }

  if (res.status === 401 && staff) {
    window.location.assign("/login");
    // The page is being replaced; never settle, so callers don't flash an error first.
    return new Promise<never>(() => {});
  }

  const data: unknown = res.status === 204 ? undefined : await res.json().catch(() => undefined);
  if (!res.ok) {
    const { error, fieldErrors } = (data ?? {}) as { error?: unknown; fieldErrors?: unknown };
    const message = typeof error === "string" ? error : "Something went wrong. Please try again.";
    throw new ApiError(res.status, message, firstMessages(fieldErrors), data);
  }
  return data as T;
}

// Session (shared staff login)

export function logIn(password: string): Promise<void> {
  return request("/session", { method: "POST", body: { password } });
}

export function logOut(): Promise<void> {
  return request("/session", { method: "DELETE" });
}

export type Session = {
  ok: true;
  // The shop's IANA time zone; use with shopToday() for the shop's calendar date.
  timeZone: string;
};

export function getSession(): Promise<Session> {
  return request("/session", { staff: true });
}

// Tickets (staff)

export type QueueTicket = {
  number: string;
  customerName: string;
  bikeDescription: string;
  status: Status;
  // YYYY-MM-DD calendar date; format with formatCalendarDate.
  promisedBy: string;
  overdue: boolean;
};

export function getQueue(status?: Status): Promise<QueueTicket[]> {
  const query = status ? `?status=${encodeURIComponent(status)}` : "";
  return request(`/tickets${query}`, { staff: true });
}

export type Ticket = {
  id: string;
  number: string;
  status: Status;
  customer: { id: string; name: string; phone: string };
  bikeDescription: string;
  problem: string | null;
  promisedBy: string;
  createdAt: string;
};

export function createTicket(input: IntakeInput): Promise<Ticket> {
  return request("/tickets", { method: "POST", body: input, staff: true });
}

export type TicketEvent = {
  // Null for the ticket's first event (created as Received).
  from: Status | null;
  to: Status;
  // Internal only; never shown to the customer.
  note: string | null;
  createdAt: string;
};

export type TicketDetail = Ticket & {
  overdue: boolean;
  // The statuses this ticket may move to now (from status.ts, via the API).
  nextStatuses: Status[];
  // Oldest first.
  history: TicketEvent[];
};

export function getTicket(number: string): Promise<TicketDetail> {
  return request(`/tickets/${encodeURIComponent(number)}`, { staff: true });
}

// A 409 (move not allowed, or someone else changed the ticket first) throws an
// ApiError with status 409.
export function changeStatus(number: string, input: StatusChangeInput): Promise<TicketDetail> {
  return request(`/tickets/${encodeURIComponent(number)}/status`, {
    method: "POST",
    body: input,
    staff: true,
  });
}

// Customer lookup (public)

export type LookupResult = {
  ticketNumber: string;
  status: Status;
  promisedBy: string;
};

// POST, so the phone digits stay out of the URL. A wrong ticket number and wrong
// digits both throw the same 404; too many tries throws a 429.
export function lookUpRepair(input: LookupInput): Promise<LookupResult> {
  return request("/lookup", { method: "POST", body: input });
}
