import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { startServer } from "./helpers.js";

let server;
test.before(async () => { server = await startServer({ FREE_QUOTES_PER_MONTH: "50" }); });
test.after(() => server.stop());

const NOTES = { notes: "Replace kitchen tap, shutoff valve seized, 2 hours", customerName: "Jane" };
// 1x1 transparent PNG.
const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

async function account(email) {
  const c = server.client();
  const { body } = await c("/api/signup", { method: "POST", body: { email, password: "password1" } });
  return { c, user: body.user };
}
async function sentQuote(c) {
  const { body: q } = await c("/api/quotes", { method: "POST", body: NOTES });
  const { body } = await c(`/api/quotes/${q.id}`, { method: "PUT", body: { quote: q.quote } });
  return body;
}
const outbox = () => {
  const f = path.join(server.dataDir, "outbox.log");
  return fs.existsSync(f) ? fs.readFileSync(f, "utf8").trim().split("\n").map((l) => JSON.parse(l)) : [];
};
const makePro = (userId) => {
  const db = new DatabaseSync(path.join(server.dataDir, "quotesmith.db"));
  db.prepare("UPDATE users SET plan = 'pro' WHERE id = ?").run(userId);
  db.close();
};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

test("quote numbers are sequential per account, including claimed drafts", async () => {
  const { c } = await account("num@example.com");
  assert.equal((await c("/api/quotes", { method: "POST", body: NOTES })).body.number, 1001);
  assert.equal((await c("/api/quotes", { method: "POST", body: NOTES })).body.number, 1002);

  const anon = server.client();
  const draft = (await anon("/api/quotes", { method: "POST", body: NOTES })).body;
  assert.equal(draft.number, null);
  await anon("/api/signup", { method: "POST", body: { email: "num2@example.com", password: "password1" } });
  const claimed = await anon(`/api/quotes/${draft.id}`, { method: "PUT", body: { key: draft.editKey, quote: draft.quote } });
  assert.equal(claimed.body.number, 1001);
});

test("deposit and payment link flow onto the quote; non-https links rejected", async () => {
  const { c } = await account("dep@example.com");
  assert.equal((await c("/api/me/profile", { method: "PUT", body: { paymentLink: "http://pay.example.com" } })).status, 400);
  assert.equal((await c("/api/me/profile", { method: "PUT", body: { paymentLink: "javascript:alert(1)" } })).status, 400);
  await c("/api/me/profile", { method: "PUT", body: { depositPercent: 150, paymentLink: "https://buy.stripe.com/test_123", phone: "555-0100" } });
  assert.equal((await c("/api/me")).body.user.profile.depositPercent, 100);
  const q = await sentQuote(c);
  const pub = (await server.client()(`/api/q/${q.id}`)).body;
  assert.equal(pub.input.paymentLink, "https://buy.stripe.com/test_123");
  assert.equal(pub.input.contactPhone, "555-0100");
});

test("logo is Pro-only, validated, and shown on the customer's quote", async () => {
  const { c, user } = await account("logo@example.com");
  assert.equal((await c("/api/me/logo", { method: "PUT", body: { dataUrl: PNG } })).status, 402);
  makePro(user.id);
  assert.equal((await c("/api/me/logo", { method: "PUT", body: { dataUrl: "data:image/svg+xml;base64,PHN2Zy8+" } })).status, 400);
  assert.equal((await c("/api/me/logo", { method: "PUT", body: { dataUrl: PNG } })).status, 200);

  const q = await sentQuote(c);
  const pub = (await server.client()(`/api/q/${q.id}`)).body;
  assert.equal(pub.hasLogo, true);
  assert.equal(pub.branded, false);
  const img = await server.client()(`/api/q/${q.id}/logo`);
  assert.equal(img.type, "image/png");
  assert.equal(img.body.subarray(1, 4).toString(), "PNG");
});

test("PDF download works for sent quotes and owners' drafts only", async () => {
  const { c } = await account("pdf@example.com");
  const draft = (await c("/api/quotes", { method: "POST", body: NOTES })).body;
  assert.equal((await server.client()(`/q/${draft.id}/pdf`)).status, 404);
  const own = await c(`/q/${draft.id}/pdf`);
  assert.equal(own.type, "application/pdf");
  assert.equal(own.body.subarray(0, 5).toString(), "%PDF-");

  await c(`/api/quotes/${draft.id}`, { method: "PUT", body: { quote: draft.quote } });
  const pdf = await server.client()(`/q/${draft.id}/pdf`);
  assert.equal(pdf.status, 200);
  assert.ok(pdf.body.length > 1000);
});

test("email alerts: accept/decline for everyone, opens for Pro only", async () => {
  const free = await account("alert-free@example.com");
  const fq = await sentQuote(free.c);
  const customer = server.client();
  await customer(`/api/q/${fq.id}`);
  await customer(`/api/q/${fq.id}/respond`, { method: "POST", body: { decision: "accept", name: "Jane Doe", note: "Tuesday works" } });
  await wait(100);
  let mail = outbox().filter((m) => m.to === "alert-free@example.com");
  assert.deepEqual(mail.map((m) => m.subject), [`Quote accepted: #1001 ${fq.quote.title}`]);
  assert.match(mail[0].text, /Tuesday works/);

  const pro = await account("alert-pro@example.com");
  makePro(pro.user.id);
  await pro.c("/api/me/profile", { method: "PUT", body: { email: "office@pro.example.com" } });
  const pq = await sentQuote(pro.c);
  await pro.c(`/api/q/${pq.id}`); // owner preview doesn't count
  await customer(`/api/q/${pq.id}`);
  await customer(`/api/q/${pq.id}`); // only the first open alerts
  await wait(100);
  mail = outbox().filter((m) => m.to === "office@pro.example.com");
  assert.deepEqual(mail.map((m) => m.subject), ["Jane just opened your quote"]);
});
