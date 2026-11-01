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

test("customers see marked-up unit prices that multiply out to the line total", async () => {
  const { unitPrice } = await import("../public/quote-render.js");
  const li = { category: "materials", quantity: 3, unit_price: 10 };
  assert.equal(unitPrice(li, 20), 12);
  assert.equal(lineTotal(li, 20), 36);
});
