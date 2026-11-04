import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { startServer } from "./helpers.js";

let server;
test.before(async () => { server = await startServer(); });
test.after(() => server.stop());

const lastResetLink = () => {
  const f = path.join(server.dataDir, "outbox.log");
  const mail = fs.readFileSync(f, "utf8").trim().split("\n").map((l) => JSON.parse(l)).filter((m) => m.subject.includes("Reset"));
  return mail.at(-1);
};

test("password reset: same answer for unknown emails, single-use token, signs out other sessions", async () => {
  const a = server.client();
  await a("/api/signup", { method: "POST", body: { email: "reset@example.com", password: "old-password" } });

  const r1 = await server.client()("/api/password/forgot", { method: "POST", body: { email: "nobody@example.com" } });
  const r2 = await server.client()("/api/password/forgot", { method: "POST", body: { email: "RESET@example.com" } });
  assert.deepEqual([r1.status, r1.body], [r2.status, r2.body]);
  await new Promise((r) => setTimeout(r, 100));

  const mail = lastResetLink();
  assert.equal(mail.to, "reset@example.com");
  const token = /token=([\w-]+)/.exec(mail.text)[1];

  const b = server.client();
  assert.equal((await b("/api/password/reset", { method: "POST", body: { token, password: "short" } })).status, 400);
  assert.equal((await b("/api/password/reset", { method: "POST", body: { token, password: "new-password" } })).status, 200);
  assert.equal((await b("/api/me")).body.user.email, "reset@example.com");
  assert.equal((await b("/api/password/reset", { method: "POST", body: { token, password: "another-one" } })).status, 400, "token is single use");

  // The session that existed before the reset is signed out; the old password no longer works.
  assert.equal((await a("/api/me")).body.user, null);
  assert.equal((await server.client()("/api/login", { method: "POST", body: { email: "reset@example.com", password: "old-password" } })).status, 401);
  assert.equal((await server.client()("/api/login", { method: "POST", body: { email: "reset@example.com", password: "new-password" } })).status, 200);
});

test("saved quotes reject negative or absurd numbers", async () => {
  const c = server.client();
  await c("/api/signup", { method: "POST", body: { email: "nums@example.com", password: "password1" } });
  const q = (await c("/api/quotes", { method: "POST", body: { notes: "Replace kitchen tap and shutoff valves, 2 hours" } })).body;
  const bad = structuredClone(q.quote);
  bad.line_items[0].unit_price = -50;
  assert.equal((await c(`/api/quotes/${q.id}`, { method: "PUT", body: { quote: bad } })).status, 400);
  bad.line_items[0].unit_price = 50;
  bad.line_items[0].quantity = 1e9;
  assert.equal((await c(`/api/quotes/${q.id}`, { method: "PUT", body: { quote: bad } })).status, 400);
});

test("content security policy is sent", async () => {
  const r = await fetch(server.base + "/");
  const csp = r.headers.get("content-security-policy");
  assert.match(csp, /default-src 'self'/);
  assert.match(csp, /frame-ancestors 'none'/);
  assert.match(csp, /object-src 'none'/);
});

test("AI service failures show a generic message, not internal details", async () => {
  // Point the SDK at a closed port so the call fails like an outage would.
  const broken = await startServer({ ANTHROPIC_API_KEY: "sk-ant-test-not-real", ANTHROPIC_BASE_URL: "http://127.0.0.1:9" });
  try {
    const r = await broken.client()("/api/quotes", { method: "POST", body: { notes: "Replace kitchen tap and shutoff valves, 2 hours" } });
    assert.equal(r.status, 502);
    assert.equal(r.body.error, "The quote service is busy right now. Please try again in a minute.");
  } finally {
    broken.stop();
  }
});
