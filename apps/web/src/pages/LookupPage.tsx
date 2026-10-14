import { SHOP_NAME, usePageTitle } from "../components/usePageTitle.ts";

// Public page for customers. No staff navigation. Placeholder until its slice is built.
export function LookupPage() {
  usePageTitle("Check your repair");
  return (
    <main className="mx-auto max-w-md px-4 py-8">
      <p className="text-sm font-semibold text-gray-600">{SHOP_NAME}</p>
      <h1 className="text-2xl font-bold text-gray-900">Check your repair</h1>
    </main>
  );
}
