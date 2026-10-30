import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const PORT = 3900 + Math.floor(Math.random() * 90);
const BASE = `http://localhost:${PORT}`;
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "qs-test-"));
let server;

test.before(async () => {
  server = spawn(process.execPath, ["--disable-warning=ExperimentalWarning", "src/server.js"], {
    env: { ...process.env, PORT, DATA_DIR: dataDir, ANTHROPIC_API_KEY: "", ANTHROPIC_AUTH_TOKEN: "", FREE_QUOTES_PER_MONTH: "2", ANON_QUOTES_PER_DAY: "1" },
    stdio: "ignore",
  });
  for (let i = 0; i < 50; i++) {
    try { if ((await fetch(`${BASE}/api/health`)).ok) return; } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error("server did not start");
});
test.after(() => { server.kill(); fs.rmSync(dataDir, { recursive: true, force: true }); });

function client() {
  let cookie = "";
  return async (url, { method = "GET", body } = {}) => {
    const r = await fetch(BASE + url, { method, headers: { "content-type": "application/json", cookie }, body: body && JSON.stringify(body) });
    const set = r.headers.get("set-cookie");
    if (set) cookie = set.split(";")[0];
    return { status: r.status, body: await r.json() };
  };
}
const NOTES = { notes: "Replace kitchen tap, shutoff valve seized, 2 hours", hourlyRate: 90 };

test("anonymous draft must be claimed by an account before it can be shared", async () => {
  const anon = client();
  const draft = await anon("/api/quotes", { method: "POST", body: NOTES });
  assert.equal(draft.status, 200);
  assert.equal(draft.body.userId, null);

  // Second anonymous quote today is blocked.
  assert.equal((await anon("/api/quotes", { method: "POST", body: NOTES })).status, 429);
  // Customer can't see a draft; saving needs login.
  assert.equal((await anon(`/api/q/${draft.body.id}`)).status, 404);
  assert.equal((await anon(`/api/quotes/${draft.body.id}`, { method: "PUT", body: { key: draft.body.editKey, quote: draft.body.quote } })).status, 401);

  assert.equal((await anon("/api/signup", { method: "POST", body: { email: "a@example.com", password: "password1" } })).status, 200);
  const saved = await anon(`/api/quotes/${draft.body.id}`, { method: "PUT", body: { key: draft.body.editKey, quote: draft.body.quote } });
  assert.equal(saved.status, 200);
  assert.equal(saved.body.status, "sent");

  const list = await anon("/api/quotes");
  assert.equal(list.body.quotes.length, 1);
  assert.deepEqual(list.body.usage, { used: 1, limit: 2 });

  // Customer view hides owner secrets.
  const pub = await client()(`/api/q/${draft.body.id}`);
  assert.equal(pub.status, 200);
  assert.equal(pub.body.editKey, undefined);
  assert.equal(pub.body.userId, undefined);
});

test("free plan is capped per month", async () => {
  const c = client();
  await c("/api/signup", { method: "POST", body: { email: "b@example.com", password: "password1" } });
  assert.equal((await c("/api/quotes", { method: "POST", body: NOTES })).status, 200);
  assert.equal((await c("/api/quotes", { method: "POST", body: NOTES })).status, 200);
  const third = await c("/api/quotes", { method: "POST", body: NOTES });
  assert.equal(third.status, 402);
  assert.equal(third.body.upgrade, true);
});

test("accounts: duplicate email, bad password, other users' quotes", async () => {
  const c = client();
  assert.equal((await c("/api/signup", { method: "POST", body: { email: "a@example.com", password: "password1" } })).status, 409);
  assert.equal((await c("/api/login", { method: "POST", body: { email: "a@example.com", password: "wrong-pass" } })).status, 401);
  await c("/api/signup", { method: "POST", body: { email: "c@example.com", password: "password1" } });
  const mine = await c("/api/quotes", { method: "POST", body: NOTES });

  const other = client();
  await other("/api/login", { method: "POST", body: { email: "b@example.com", password: "password1" } });
  assert.equal((await other(`/api/quotes/${mine.body.id}/edit`)).status, 404);
  assert.equal((await other(`/api/quotes/${mine.body.id}`, { method: "PUT", body: { quote: mine.body.quote } })).status, 404);
  assert.equal((await c(`/api/quotes/${mine.body.id}/edit`)).status, 200);
});
