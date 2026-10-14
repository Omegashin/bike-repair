import { loginSchema } from "@bike-repair/shared";
import { Router } from "express";
import { endSession, isStaffPassword, requireStaff, startSession } from "../middleware/auth.ts";

export const sessionRouter = Router();

// Log in with the shared shop password.
sessionRouter.post("/", (req, res) => {
  const { password } = loginSchema.parse(req.body);
  if (!isStaffPassword(password)) {
    res.status(401).json({ error: "Wrong password" });
    return;
  }
  startSession(req, res);
  res.status(204).end();
});

// Lets the web app check whether it is logged in.
sessionRouter.get("/", requireStaff, (_req, res) => {
  res.json({ ok: true });
});

sessionRouter.delete("/", (req, res) => {
  endSession(req, res);
  res.status(204).end();
});
