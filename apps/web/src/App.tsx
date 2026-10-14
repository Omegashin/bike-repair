import { BrowserRouter, Link, Route, Routes } from "react-router";
import { StaffLayout } from "./components/StaffLayout.tsx";
import { usePageTitle } from "./components/usePageTitle.ts";
import { IntakePage } from "./pages/IntakePage.tsx";
import { LoginPage } from "./pages/LoginPage.tsx";
import { LookupPage } from "./pages/LookupPage.tsx";
import { QueuePage } from "./pages/QueuePage.tsx";
import { TicketPage } from "./pages/TicketPage.tsx";

// Staff screens sit inside StaffLayout (header + session check); /login and the
// customer's /status page stand alone.
export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/status" element={<LookupPage />} />
        <Route element={<StaffLayout />}>
          <Route index element={<QueuePage />} />
          <Route path="/tickets/new" element={<IntakePage />} />
          <Route path="/tickets/:number" element={<TicketPage />} />
        </Route>
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  );
}

function NotFoundPage() {
  usePageTitle("Page not found");
  return (
    <main className="mx-auto max-w-md px-4 py-16">
      <h1 className="mb-4 text-2xl font-bold text-gray-900">Page not found</h1>
      <p className="text-gray-700">
        Checking on a repair? Go to the{" "}
        <Link to="/status" className="font-semibold text-blue-700 underline">
          repair status page
        </Link>
        .
      </p>
    </main>
  );
}
