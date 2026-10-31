import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import Stripe from "stripe";
import { startServer } from "./helpers.js";

const WEBHOOK_SECRET = "whsec_test_secret";
const calls = [];
let fake, server;

// Minimal stand-in for the Stripe API that records what the app sends.
test.before(async () => {
  fake = http.createServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      calls.push({ path: req.url, params: new URLSearchParams(body) });
      const replies = {
        "/v1/customers": { id: "cus_123", object: "customer" },
        "/v1/checkout/sessions": { id: "cs_1", object: "checkout.session", url: "https://checkout.stripe.test/cs_1" },
        "/v1/billing_portal/sessions": { id: "bps_1", object: "billing_portal.session", url: "https://billing.stripe.test/p" },
      };
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify(replies[req.url] || {}));
    });
  });
  await new Promise((r) => fake.listen(0, r));
  server = await startServer({
    STRIPE_SECRET_KEY: "sk_test_fake", STRIPE_PRICE_PRO: "price_pro", STRIPE_WEBHOOK_SECRET: WEBHOOK_SECRET,
    STRIPE_API_BASE: `http://localhost:${fake.address().port}`, FREE_QUOTES_PER_MONTH: "1",
  });
});
test.after(() => { server.stop(); fake.close(); });

const stripe = new Stripe("sk_test_fake");
function signed(event) {
  const payload = JSON.stringify(event);
  return { raw: payload, headers: { "stripe-signature": stripe.webhooks.generateTestHeaderString({ payload, secret: WEBHOOK_SECRET }) } };
}
const sendWebhook = (c, event) => c("/api/stripe/webhook", { method: "POST", ...signed(event) });
const NOTES = { notes: "Replace kitchen tap, shutoff valve seized, 2 hours" };

test("checkout, webhook upgrade, unlimited quotes, cancellation", async () => {
  const c = server.client();
  const { body: { user } } = await c("/api/signup", { method: "POST", body: { email: "pay@example.com", password: "password1" } });
  assert.deepEqual((await c("/api/me")).body.billing.plans, ["pro"]);

  // Crew has no price configured, so it can't be bought.
  assert.equal((await c("/api/billing/checkout", { method: "POST", body: { plan: "crew" } })).status, 503);

  const co = await c("/api/billing/checkout", { method: "POST", body: { plan: "pro" } });
  assert.equal(co.status, 200);
  assert.equal(co.body.url, "https://checkout.stripe.test/cs_1");
  const session = calls.find((x) => x.path === "/v1/checkout/sessions").params;
  assert.equal(session.get("mode"), "subscription");
  assert.equal(session.get("customer"), "cus_123");
  assert.equal(session.get("line_items[0][price]"), "price_pro");
  assert.equal(session.get("subscription_data[metadata][userId]"), user.id);

  // Use up the free quota, then upgrade via webhook.
  await c("/api/quotes", { method: "POST", body: NOTES });
  assert.equal((await c("/api/quotes", { method: "POST", body: NOTES })).status, 402);

  const done = await sendWebhook(c, { id: "evt_1", object: "event", type: "checkout.session.completed",
    data: { object: { object: "checkout.session", mode: "subscription", customer: "cus_123", subscription: "sub_1", client_reference_id: user.id, metadata: { userId: user.id, plan: "pro" } } } });
  assert.equal(done.status, 200);
  let me = (await c("/api/me")).body;
  assert.equal(me.user.plan, "pro");
  assert.equal(me.usage.limit, null);
  assert.equal((await c("/api/quotes", { method: "POST", body: NOTES })).status, 200);

  // Portal works now that there's a customer.
  assert.equal((await c("/api/billing/portal", { method: "POST" })).body.url, "https://billing.stripe.test/p");

  // Failed payment keeps access but flags it; cancellation drops to free.
  await sendWebhook(c, { id: "evt_2", object: "event", type: "customer.subscription.updated",
    data: { object: { object: "subscription", id: "sub_1", customer: "cus_123", status: "past_due", metadata: {}, items: { data: [{ price: { id: "price_pro" } }] } } } });
  me = (await c("/api/me")).body;
  assert.equal(me.user.plan, "pro");
  assert.equal(me.user.planStatus, "past_due");

  await sendWebhook(c, { id: "evt_3", object: "event", type: "customer.subscription.deleted",
    data: { object: { object: "subscription", id: "sub_1", customer: "cus_123", status: "canceled", metadata: {}, items: { data: [] } } } });
  assert.equal((await c("/api/me")).body.user.plan, "free");
});

test("webhook rejects bad signatures", async () => {
  const c = server.client();
  const r = await c("/api/stripe/webhook", { method: "POST", raw: JSON.stringify({ type: "checkout.session.completed" }), headers: { "stripe-signature": "t=1,v1=bad" } });
  assert.equal(r.status, 400);
});

test("billing endpoints need a configured Stripe and a login", async () => {
  const c = server.client();
  assert.equal((await c("/api/billing/checkout", { method: "POST", body: { plan: "pro" } })).status, 401);
  const off = await startServer();
  try {
    const oc = off.client();
    await oc("/api/signup", { method: "POST", body: { email: "x@example.com", password: "password1" } });
    assert.equal((await oc("/api/billing/checkout", { method: "POST", body: { plan: "pro" } })).status, 503);
    assert.equal((await oc("/api/me")).body.billing.enabled, false);
  } finally {
    off.stop();
  }
});
