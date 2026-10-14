// The single source of truth for ticket statuses and allowed transitions.
// The API rejects anything not listed here; the UI only offers these moves.

export const STATUSES = [
  "received",
  "diagnosing",
  "waiting_on_parts",
  "in_progress",
  "ready_for_pickup",
  "picked_up",
] as const;

export type Status = (typeof STATUSES)[number];

export const ALLOWED_TRANSITIONS: Record<Status, readonly Status[]> = {
  received: ["diagnosing"],
  diagnosing: ["waiting_on_parts", "in_progress"],
  waiting_on_parts: ["in_progress"],
  in_progress: ["waiting_on_parts", "ready_for_pickup"],
  ready_for_pickup: ["picked_up"],
  picked_up: [],
};

export function nextStatuses(from: Status): readonly Status[] {
  return ALLOWED_TRANSITIONS[from];
}

export function canTransition(from: Status, to: Status): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

// Short labels for staff screens (queue, ticket detail, status buttons).
export const STATUS_LABELS: Record<Status, string> = {
  received: "Received",
  diagnosing: "Diagnosing",
  waiting_on_parts: "Waiting on parts",
  in_progress: "In progress",
  ready_for_pickup: "Ready for pickup",
  picked_up: "Picked up",
};

// Plain-language text for the customer lookup page.
export const CUSTOMER_STATUS_TEXT: Record<Status, string> = {
  received: "We've got your bike and it's in the queue.",
  diagnosing: "A mechanic is checking what your bike needs.",
  waiting_on_parts: "We're waiting for parts to arrive.",
  in_progress: "Your bike is being repaired.",
  ready_for_pickup: "Your bike is ready to pick up.",
  picked_up: "You've picked up your bike. Thanks for riding with us!",
};
