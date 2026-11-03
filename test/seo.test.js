import test from "node:test";
import assert from "node:assert/strict";
import { startServer } from "./helpers.js";
import { TRADES } from "../src/trades.js";

let server;
test.before(async () => { server = await startServer({ APP_URL: "https://quotesmith.example" }); });
test.after(() => server.stop());

async function get(path) {
  const r = await fetch(server.base + path);
  return { status: r.status, type: r.headers.get("content-type"), headers: r.headers, text: await r.text() };
}

test("every trade page renders with its example, FAQ schema and a prefilled CTA", async () => {
  for (const t of TRADES) {
    const r = await get(`/quote-template/${t.slug}`);
    assert.equal(r.status, 200, t.slug);
    assert.match(r.text, new RegExp(`<h1>${t.name} quote template</h1>`));
    assert.match(r.text, /"@type":"FAQPage"/);
    assert.ok(r.text.includes(`<link rel="canonical" href="https://quotesmith.example/quote-template/${t.slug}"`));
    assert.ok(r.text.includes(`/app?trade=${encodeURIComponent(t.trade)}`));
    // Example subtotal is the sum of its lines.
    const sum = t.example.items.reduce((s, [, , q, , p]) => s + q * p, 0);
    assert.ok(r.text.includes(new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(sum)), `${t.slug} subtotal`);
  }
  assert.equal((await get("/quote-template/astronaut")).status, 404);
});

test("sitemap, robots and indexing rules", async () => {
  const map = await get("/sitemap.xml");
  assert.match(map.type, /xml/);
  assert.equal((map.text.match(/<loc>/g) || []).length, TRADES.length + 2);
  const robots = await get("/robots.txt");
  assert.match(robots.text, /Disallow: \/q\//);
  assert.match(robots.text, /Sitemap: https:\/\/quotesmith.example\/sitemap.xml/);
  assert.match((await get("/quote.html")).text, /noindex/);
});

test("security headers on every response", async () => {
  const r = await get("/");
  assert.equal(r.headers.get("x-content-type-options"), "nosniff");
  assert.equal(r.headers.get("x-frame-options"), "DENY");
  assert.equal(r.headers.get("x-powered-by"), null);
});
