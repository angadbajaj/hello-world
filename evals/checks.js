// Automatic checks for a generated quote. Each returns null when it passes, or a short failure reason.
const text = (q) => [q.title, q.summary, ...q.line_items.map((l) => l.description), ...q.scope_of_work].join(" ").toLowerCase();
const subtotal = (q, markup = 0) => q.line_items.reduce((s, l) =>
  s + l.quantity * l.unit_price * (l.category === "materials" ? 1 + markup / 100 : 1), 0);

export const CHECKS = {
  // Every hourly labor line uses the contractor's rate.
  laborRate: (q, c) => {
    const bad = q.line_items.filter((l) => l.category === "labor" && /^(hr|hour|hours|hrs?)$/i.test(l.unit) && l.unit_price !== c.input.hourlyRate);
    return bad.length ? `labor at ${bad.map((l) => l.unit_price).join(", ")} instead of ${c.input.hourlyRate}` : null;
  },
  // Labor in quarter hours.
  quarterHours: (q) => {
    const bad = q.line_items.filter((l) => l.category === "labor" && /^h/i.test(l.unit) && Math.abs(l.quantity * 4 - Math.round(l.quantity * 4)) > 1e-9);
    return bad.length ? `labor quantities not in quarter hours: ${bad.map((l) => l.quantity).join(", ")}` : null;
  },
  hasLaborAndMaterials: (q) => {
    const cats = new Set(q.line_items.map((l) => l.category));
    return cats.has("labor") && cats.has("materials") ? null : `categories were ${[...cats].join(", ")}`;
  },
  noZeroPrices: (q) => {
    const bad = q.line_items.filter((l) => !(l.unit_price > 0) || !(l.quantity > 0));
    return bad.length ? `zero/negative lines: ${bad.map((l) => l.description).join("; ")}` : null;
  },
  hasExclusions: (q) => (q.exclusions.length ? null : "no exclusions"),
  depositInTerms: (q, c) =>
    q.terms.some((t) => t.includes(`${c.input.depositPercent}%`)) ? null : `terms don't state ${c.input.depositPercent}% deposit`,
  // Price book items the job needs are reused verbatim.
  usesPriceBook: (q, c) => {
    const missing = c.expect.priceBookUsed.filter((d) => {
      const item = c.priceBook.find((i) => i.description === d);
      return !q.line_items.some((l) => l.description === item.description && l.unit_price === item.unit_price);
    });
    return missing.length ? `price book items not reused exactly: ${missing.join("; ")}` : null;
  },
  subtotalRange: (q, c) => {
    const s = subtotal(q, c.input.markup);
    const [lo, hi] = c.expect.subtotal;
    return s >= lo && s <= hi ? null : `subtotal ${s.toFixed(2)} outside ${lo}-${hi}`;
  },
  mentions: (q, c) => {
    // "a|b" means either word counts.
    const missing = c.expect.mentions.filter((w) => !w.toLowerCase().split("|").some((alt) => text(q).includes(alt)));
    return missing.length ? `scope never mentions: ${missing.join(", ")}` : null;
  },
  // Vague notes should produce questions rather than invented detail.
  asksQuestions: (q) => (q.questions_for_client.length ? null : "vague notes but no questions for the client"),
};

// Checks that apply to every case, plus the ones a case opts into via `expect`.
export function runChecks(quote, c) {
  const names = ["noZeroPrices", "hasExclusions", "quarterHours"];
  if (c.input.hourlyRate) names.push("laborRate");
  if (c.input.depositPercent) names.push("depositInTerms");
  if (c.expect?.laborAndMaterials) names.push("hasLaborAndMaterials");
  if (c.expect?.priceBookUsed) names.push("usesPriceBook");
  if (c.expect?.subtotal) names.push("subtotalRange");
  if (c.expect?.mentions) names.push("mentions");
  if (c.expect?.asksQuestions) names.push("asksQuestions");
  return names.map((name) => ({ name, error: CHECKS[name](quote, c) }));
}
