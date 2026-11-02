import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { runChecks } from "../evals/checks.js";

const cases = JSON.parse(fs.readFileSync("evals/cases.json", "utf8"));
const byId = (id) => ({ priceBook: [], ...cases.find((c) => c.id === id) });

const good = {
  title: "Toilet reset", summary: "Reset toilet", estimated_duration: "2 hours",
  line_items: [
    { description: "Pull and reset toilet, replace fill valve", category: "labor", quantity: 1.5, unit: "hr", unit_price: 110 },
    { description: "Wax ring with horn", category: "materials", quantity: 1, unit: "each", unit_price: 8.5 },
    { description: "Closet bolt kit (brass)", category: "materials", quantity: 1, unit: "kit", unit_price: 6 },
    { description: "Fluidmaster 400 fill valve", category: "materials", quantity: 1, unit: "each", unit_price: 14.75 },
  ],
  scope_of_work: ["Reset toilet"], exclusions: ["Flooring repair"], assumptions: [], terms: ["Valid 30 days"], questions_for_client: [],
};

test("every case is well-formed", () => {
  const ids = new Set();
  for (const c of cases) {
    assert.ok(c.id && !ids.has(c.id), `duplicate or missing id ${c.id}`);
    ids.add(c.id);
    assert.ok(c.input.notes && c.input.trade, c.id);
    for (const d of c.expect?.priceBookUsed || []) assert.ok(c.priceBook.some((i) => i.description === d), `${c.id}: ${d}`);
  }
});

test("a correct quote passes its checks", () => {
  const results = runChecks(good, byId("plumb-pricebook"));
  assert.deepEqual(results.filter((r) => r.error), []);
  assert.ok(results.some((r) => r.name === "usesPriceBook"));
});

test("checks catch the mistakes they exist for", () => {
  const bad = structuredClone(good);
  bad.line_items[0].unit_price = 95;          // wrong rate
  bad.line_items[0].quantity = 1.6;           // not quarter hours
  bad.line_items[1].unit_price = 9.99;        // price book price not reused
  bad.exclusions = [];
  const failed = runChecks(bad, byId("plumb-pricebook")).filter((r) => r.error).map((r) => r.name).sort();
  assert.deepEqual(failed, ["hasExclusions", "laborRate", "quarterHours", "usesPriceBook"]);
});
