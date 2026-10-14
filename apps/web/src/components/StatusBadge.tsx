import { STATUS_LABELS, type Status } from "@bike-repair/shared";

const badgeColors: Record<Status, string> = {
  received: "bg-gray-100 text-gray-800 ring-gray-300",
  diagnosing: "bg-sky-50 text-sky-900 ring-sky-300",
  waiting_on_parts: "bg-amber-50 text-amber-900 ring-amber-300",
  in_progress: "bg-indigo-50 text-indigo-900 ring-indigo-300",
  ready_for_pickup: "bg-green-50 text-green-900 ring-green-400",
  picked_up: "bg-gray-50 text-gray-600 ring-gray-200",
};

// Staff-facing status: always the label, never the raw value.
export function StatusBadge({ status }: { status: Status }) {
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-0.5 text-sm font-medium whitespace-nowrap ring-1 ring-inset ${badgeColors[status]}`}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}

// Text, not only colour, so overdue tickets stand out for everyone.
export function OverdueTag() {
  return (
    <span className="inline-block rounded bg-red-700 px-2 py-0.5 text-sm font-bold tracking-wide text-white uppercase">
      Overdue
    </span>
  );
}
