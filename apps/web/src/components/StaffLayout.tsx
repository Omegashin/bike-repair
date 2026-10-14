import { useEffect, useState } from "react";
import { Link, Outlet, useNavigate } from "react-router";
import { getSession, logOut } from "../api.ts";
import { Button, ButtonLink } from "./Button.tsx";
import type { StaffContext } from "./staffContext.ts";
import { SHOP_NAME } from "./usePageTitle.ts";

// Header and session check shared by every staff screen. Without a session, the
// session check's 401 sends the browser to /login (see api.ts).
export function StaffLayout() {
  const navigate = useNavigate();
  // Undefined until the session check finishes.
  const [context, setContext] = useState<StaffContext>();
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    getSession()
      .then(({ timeZone }) => setContext({ timeZone }))
      // Server unreachable: show the page anyway; its own requests will report the error.
      .catch(() => setContext({ timeZone: undefined }));
  }, []);

  async function handleLogOut() {
    setLoggingOut(true);
    try {
      await logOut();
    } finally {
      navigate("/login");
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <Link to="/" className="rounded text-lg font-bold text-gray-900">
            {SHOP_NAME}
          </Link>
          <nav aria-label="Staff" className="flex gap-2">
            <ButtonLink to="/tickets/new">New ticket</ButtonLink>
            <Button variant="secondary" onClick={handleLogOut} disabled={loggingOut}>
              Log out
            </Button>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">{context && <Outlet context={context} />}</main>
    </div>
  );
}
