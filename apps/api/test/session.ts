import request from "supertest";
import { createApp } from "../src/app.ts";

// A Supertest agent holding a staff session cookie, for tests of staff endpoints.
export async function staffAgent(app = createApp()) {
  const agent = request.agent(app);
  const res = await agent.post("/api/session").send({ password: process.env.STAFF_PASSWORD });
  if (res.status !== 204) throw new Error(`Staff login failed with ${res.status}`);
  return agent;
}
