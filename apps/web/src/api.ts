// The only place the web app calls fetch. One typed function per endpoint.

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

export function getSession(): Promise<{ ok: true }> {
  return request("/session", { staff: true });
}
