import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { staffAgent } from "../../test/session.ts";
import { createApp } from "../app.ts";

const app = createApp();

function sessionCookie(res: request.Response): string | undefined {
  const cookies = ([] as string[]).concat(res.headers["set-cookie"] ?? []);
  return cookies.find((c) => c.startsWith("staff_session="));
}

describe("POST /api/session", () => {
  it("sets an httpOnly session cookie for the shop password", async () => {
    const res = await request(app)
      .post("/api/session")
      .send({ password: process.env.STAFF_PASSWORD });
    expect(res.status).toBe(204);
    const cookie = sessionCookie(res);
    expect(cookie).toMatch(/HttpOnly/);
    expect(cookie).toMatch(/SameSite=Lax/);
  });

  it("returns 401 and no cookie for a wrong password", async () => {
    const res = await request(app).post("/api/session").send({ password: "wrong" });
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: "Wrong password" });
    expect(sessionCookie(res)).toBeUndefined();
  });

  it("returns 400 with field errors when the password is missing", async () => {
    const res = await request(app).post("/api/session").send({});
    expect(res.status).toBe(400);
    expect(res.body.fieldErrors).toHaveProperty("password");
  });

  it("returns 400 for a malformed JSON body", async () => {
    const res = await request(app)
      .post("/api/session")
      .set("Content-Type", "application/json")
      .send("{not json");
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: "Invalid JSON body" });
  });
});

describe("staff session check (GET /api/session)", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns 401 without a session", async () => {
    const res = await request(app).get("/api/session");
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: "Staff login required" });
  });

  it("returns 200 and the shop's time zone with a valid session", async () => {
    const agent = await staffAgent(app);
    const res = await agent.get("/api/session");
    expect(res.status).toBe(200);
    // The web app needs it to work out the shop's date (intake's earliest promised-by date).
    expect(res.body).toEqual({ ok: true, timeZone: process.env.SHOP_TIME_ZONE });
  });

  it("returns 401 for a tampered cookie", async () => {
    const login = await request(app)
      .post("/api/session")
      .send({ password: process.env.STAFF_PASSWORD });
    const value = sessionCookie(login)!.split(";")[0].split("=")[1];
    const [expiresAt, signature] = value.split(".");
    const forged = `${Number(expiresAt) + 1}.${signature}`;
    const res = await request(app).get("/api/session").set("Cookie", `staff_session=${forged}`);
    expect(res.status).toBe(401);
  });

  it("returns 401 once the session has expired", async () => {
    const agent = await staffAgent(app);
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(Date.now() + 31 * 24 * 60 * 60 * 1000);
    const res = await agent.get("/api/session");
    expect(res.status).toBe(401);
  });
});

describe("DELETE /api/session", () => {
  it("logs out", async () => {
    const agent = await staffAgent(app);
    const res = await agent.delete("/api/session");
    expect(res.status).toBe(204);
    expect(sessionCookie(res)).toMatch(/staff_session=;/);
    expect((await agent.get("/api/session")).status).toBe(401);
  });
});
