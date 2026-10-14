import { useId, type InputHTMLAttributes } from "react";

type FieldProps = {
  label: string;
  error?: string;
  hint?: string;
  required?: boolean;
  // A textarea for longer free text.
  multiline?: boolean;
  // Side by side with another Field (from sm up): share its label, hint, input and
  // error rows, so the inputs line up even when only one of them has a hint.
  inRow?: boolean;
} & InputHTMLAttributes<HTMLInputElement & HTMLTextAreaElement>;

// A labelled input with its error announced right below it.
export function Field({
  label,
  error,
  hint,
  required,
  multiline,
  inRow,
  className,
  ...input
}: FieldProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [hint && hintId, error && errorId].filter(Boolean).join(" ") || undefined;
  const inputClass = `block w-full min-h-11 rounded-md border bg-white px-3 py-2 text-base text-gray-900 ${
    error ? "border-red-700" : "border-gray-400"
  } ${className ?? ""}`;

  const shared = {
    id,
    required,
    "aria-invalid": error ? true : undefined,
    "aria-describedby": describedBy,
    className: inputClass,
    ...input,
  };

  return (
    <div className={inRow ? "sm:row-span-4 sm:grid sm:grid-rows-subgrid" : undefined}>
      <label htmlFor={id} className="mb-1 block font-medium text-gray-900">
        {label}
        {required ? (
          <span className="text-red-700" aria-hidden="true">
            {" "}
            *
          </span>
        ) : (
          <span className="font-normal text-gray-600"> (optional)</span>
        )}
      </label>
      {hint ? (
        <p id={hintId} className="mb-1 text-sm text-gray-600">
          {hint}
        </p>
      ) : (
        // Holds the hint row open beside a Field that has one.
        inRow && <span aria-hidden="true" />
      )}
      {multiline ? <textarea rows={3} {...shared} /> : <input {...shared} />}
      {/* Always rendered so screen readers announce an error when it appears. */}
      <p id={errorId} role="alert" className="mt-1 text-sm font-medium text-red-700 empty:hidden">
        {error}
      </p>
    </div>
  );
}
