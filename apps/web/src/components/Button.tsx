import type { ButtonHTMLAttributes } from "react";
import { Link, type LinkProps } from "react-router";

type Variant = "primary" | "secondary";

// At least 44px tall so it's easy to hit on a tablet or phone.
const base =
  "inline-flex min-h-11 items-center justify-center rounded-md px-4 py-2 text-base font-semibold disabled:cursor-not-allowed disabled:opacity-60";

const variants: Record<Variant, string> = {
  primary: "bg-blue-700 text-white hover:bg-blue-800",
  secondary: "border border-gray-400 bg-white text-gray-900 hover:bg-gray-100",
};

function buttonClass(variant: Variant = "primary", extra = "") {
  return `${base} ${variants[variant]} ${extra}`;
}

type ButtonProps = { variant?: Variant } & ButtonHTMLAttributes<HTMLButtonElement>;

export function Button({ variant, className, type = "button", ...props }: ButtonProps) {
  return <button type={type} className={buttonClass(variant, className)} {...props} />;
}

// A link that looks like a button (navigation, not an action).
export function ButtonLink({
  variant,
  className,
  ...props
}: { variant?: Variant; className?: string } & LinkProps) {
  return <Link className={buttonClass(variant, className)} {...props} />;
}
