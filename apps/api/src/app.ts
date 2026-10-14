import express from "express";
import path from "node:path";
import { assertAuthConfig, requireStaff } from "./middleware/auth.ts";
import { errorHandler } from "./middleware/errors.ts";
import { createLookupRouter } from "./routes/lookup.ts";
import { sessionRouter } from "./routes/session.ts";
import { shopTimeZone } from "./db.ts";
import { createTicketsRouter } from "./routes/tickets.ts";

type AppOptions = {
  // Built frontend (apps/web/dist). When set, Express serves it so the app runs from one URL.
  webDir?: string;
};

export function createApp({ webDir }: AppOptions = {}) {
  assertAuthConfig();
  const timeZone = shopTimeZone();
  const app = express();
  // Behind one reverse proxy (Render), take the client IP from its X-Forwarded-For entry
  // so the lookup rate limit counts real clients. Off by default: without a proxy, a
  // client could set the header itself to dodge the limit.
  if (process.env.TRUST_PROXY === "1") app.set("trust proxy", 1);
  app.use(express.json());

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true });
  });

  app.use("/api/session", sessionRouter);
  app.use("/api/tickets", requireStaff, createTicketsRouter({ timeZone }));
  app.use("/api/lookup", createLookupRouter());

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
