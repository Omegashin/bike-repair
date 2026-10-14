import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import type { CookieOptions, Request, RequestHandler, Response } from "express";

// One shared staff login (see decisions.md). The session is a signed cookie holding
// only its expiry time, so the server keeps no session state.

const COOKIE_NAME = "staff_session";
const SESSION_DAYS = 30;

function secret(): string {
  const value = process.env.SESSION_SECRET;
  if (!value || value.length < 32) {
    throw new Error("SESSION_SECRET must be set to at least 32 characters (see .env.example)");
  }
  return value;
}

function staffPassword(): string {
  const value = process.env.STAFF_PASSWORD;
  if (!value) throw new Error("STAFF_PASSWORD must be set (see .env.example)");
  return value;
}

// Fail at startup rather than on the first login.
export function assertAuthConfig() {
  secret();
  staffPassword();
}

function sign(expiresAt: number): string {
  return createHmac("sha256", secret()).update(`staff.${expiresAt}`).digest("base64url");
}

// Constant-time comparison; hashing first makes the lengths equal.
function safeEqual(a: string, b: string): boolean {
  const hash = (s: string) => createHash("sha256").update(s).digest();
  return timingSafeEqual(hash(a), hash(b));
}

export function isStaffPassword(password: string): boolean {
  return safeEqual(password, staffPassword());
}

function cookieOptions(req: Request): CookieOptions {
  return { httpOnly: true, sameSite: "lax", secure: req.secure, path: "/" };
}

export function startSession(req: Request, res: Response) {
  const expiresAt = Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000;
  res.cookie(COOKIE_NAME, `${expiresAt}.${sign(expiresAt)}`, {
    ...cookieOptions(req),
    expires: new Date(expiresAt),
  });
}

export function endSession(req: Request, res: Response) {
  res.clearCookie(COOKIE_NAME, cookieOptions(req));
}

function readCookie(req: Request, name: string): string | undefined {
  for (const part of req.headers.cookie?.split(";") ?? []) {
    const [key, ...value] = part.trim().split("=");
    if (key === name) return value.join("=");
  }
  return undefined;
}

function hasValidSession(req: Request): boolean {
  const [expiresAt, signature] = readCookie(req, COOKIE_NAME)?.split(".") ?? [];
  if (!expiresAt || !signature || !/^\d+$/.test(expiresAt)) return false;
  return safeEqual(signature, sign(Number(expiresAt))) && Number(expiresAt) > Date.now();
}

// Guards staff endpoints: 401 without a valid session.
export const requireStaff: RequestHandler = (req, res, next) => {
  if (hasValidSession(req)) return next();
  res.status(401).json({ error: "Staff login required" });
};
