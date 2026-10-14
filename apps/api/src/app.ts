import express from "express";
import path from "node:path";
import { assertAuthConfig, requireStaff } from "./middleware/auth.ts";
import { errorHandler } from "./middleware/errors.ts";
import { sessionRouter } from "./routes/session.ts";
import { ticketsRouter } from "./routes/tickets.ts";

type AppOptions = {
  // Built frontend (apps/web/dist). When set, Express serves it so the app runs from one URL.
  webDir?: string;
};

export function createApp({ webDir }: AppOptions = {}) {
  assertAuthConfig();
  const app = express();
  app.use(express.json());

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true });
  });

  app.use("/api/session", sessionRouter);
  app.use("/api/tickets", requireStaff, ticketsRouter);

  // Unknown API routes get JSON, never the frontend's index.html.
  app.use("/api", (_req, res) => {
    res.status(404).json({ error: "Not found" });
  });

  if (webDir) {
    app.use(express.static(webDir));
    // Client-side routes (e.g. /status) all load the single-page app.
    app.get("/{*path}", (_req, res) => {
      res.sendFile(path.join(webDir, "index.html"));
    });
  }

  app.use(errorHandler);

  return app;
}
