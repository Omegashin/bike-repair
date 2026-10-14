import { loginSchema } from "@bike-repair/shared";
import { Router } from "express";
import { endSession, isStaffPassword, requireStaff, startSession } from "../middleware/auth.ts";

type RouterOptions = {
  // The shop's IANA time zone, read once at startup (see createApp).
  timeZone: string;
};

export function createSessionRouter({ timeZone }: RouterOptions) {
  const router = Router();

  // Log in with the shared shop password.
  router.post("/", (req, res) => {
    const { password } = loginSchema.parse(req.body);
    if (!isStaffPassword(password)) {
      res.status(401).json({ error: "Wrong password" });
      return;
    }
    startSession(req, res);
    res.status(204).end();
  });

  // Lets the web app check whether it is logged in. The time zone lets it work out
  // the shop's date (e.g. the earliest promised-by date) instead of the browser's.
  router.get("/", requireStaff, (_req, res) => {
    res.json({ ok: true, timeZone });
  });

  router.delete("/", (req, res) => {
    endSession(req, res);
    res.status(204).end();
  });

  return router;
}
