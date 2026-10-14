import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "./app.ts";

describe("GET /api/health", () => {
  it("responds ok", async () => {
    const res = await request(createApp()).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });
});

describe("unknown API routes", () => {
  it("return a JSON 404", async () => {
    const res = await request(createApp()).get("/api/nope");
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: "Not found" });
  });
});
