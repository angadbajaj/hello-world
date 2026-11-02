// Scores the quote AI against evals/cases.json. Needs ANTHROPIC_API_KEY (real model calls, a few cents each).
//   npm run eval                 run every case
//   npm run eval -- plumb elec   run cases whose id contains any of these words
import fs from "node:fs";
import path from "node:path";
import { generateQuote, aiEnabled } from "../src/ai.js";
import { runChecks } from "../evals/checks.js";

if (!aiEnabled()) {
  console.error("Set ANTHROPIC_API_KEY to run the eval (it calls the real model).");
  process.exit(1);
}

const filters = process.argv.slice(2);
const cases = JSON.parse(fs.readFileSync("evals/cases.json", "utf8"))
  .filter((c) => !filters.length || filters.some((f) => c.id.includes(f)));

async function runCase(c) {
  const started = Date.now();
  try {
    const quote = await generateQuote({ currency: "USD", markup: 0, ...c.input }, { priceBook: c.priceBook || [] });
    return { id: c.id, ms: Date.now() - started, quote, checks: runChecks(quote, { ...c, priceBook: c.priceBook || [] }) };
  } catch (err) {
    return { id: c.id, ms: Date.now() - started, error: err.message, checks: [] };
  }
}

// A few at a time to stay well inside rate limits.
const results = [];
for (let i = 0; i < cases.length; i += 4) results.push(...(await Promise.all(cases.slice(i, i + 4).map(runCase))));

let passed = 0, total = 0;
for (const r of results) {
  const fails = r.checks.filter((c) => c.error);
  total += r.checks.length + (r.error ? 1 : 0);
  passed += r.checks.length - fails.length;
  console.log(`${r.error || fails.length ? "FAIL" : "pass"}  ${r.id.padEnd(18)} ${(r.ms / 1000).toFixed(1)}s`);
  if (r.error) console.log(`      error: ${r.error}`);
  for (const f of fails) console.log(`      ${f.name}: ${f.error}`);
}
console.log(`\n${passed}/${total} checks passed across ${results.length} cases`);

fs.mkdirSync("evals/results", { recursive: true });
const out = path.join("evals/results", `${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
fs.writeFileSync(out, JSON.stringify(results, null, 2));
console.log(`Full output: ${out}`);
