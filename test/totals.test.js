import test from "node:test";
import assert from "node:assert/strict";
import { totals, lineTotal } from "../public/quote-render.js";

const quote = {
  line_items: [
    { category: "labor", quantity: 2, unit_price: 90 },
    { category: "materials", quantity: 1, unit_price: 100 },
  ],
};

test("markup applies only to materials", () => {
  assert.equal(lineTotal(quote.line_items[0], 20), 180);
  assert.equal(lineTotal(quote.line_items[1], 20), 120);
});

test("tax applies to the marked-up subtotal", () => {
  const t = totals(quote, { markup: 20, taxRate: 10 });
  assert.equal(t.subtotal, 300);
  assert.equal(t.tax, 30);
  assert.equal(t.total, 330);
});
