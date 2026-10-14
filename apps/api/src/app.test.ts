import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp } from "./app.ts";

describe("startup config", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("fails fast when SHOP_TIME_ZONE is missing", () => {
    vi.stubEnv("SHOP_TIME_ZONE", "");
    expect(() => createApp()).toThrow(/SHOP_TIME_ZONE must be set/);
  });

  it("fails fast when SHOP_TIME_ZONE isn't a valid IANA time zone", () => {
    vi.stubEnv("SHOP_TIME_ZONE", "Vancouver");
    expect(() => createApp()).toThrow(/SHOP_TIME_ZONE "Vancouver" is not a valid IANA time zone/);
  });
});

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
