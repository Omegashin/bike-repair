import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
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

describe("serving the built frontend", () => {
  const webDir = mkdtempSync(path.join(tmpdir(), "web-dist-"));
  writeFileSync(path.join(webDir, "index.html"), "<div id=root></div>");
  const app = createApp({ webDir });

  it("serves index.html for / and client-side routes", async () => {
    for (const url of ["/", "/status"]) {
      const res = await request(app).get(url);
      expect(res.status, url).toBe(200);
      expect(res.text, url).toContain("<div id=root>");
    }
  });

  it("keeps API 404s as JSON when the frontend is served", async () => {
    const res = await request(app).get("/api/nope");
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: "Not found" });
  });
});
