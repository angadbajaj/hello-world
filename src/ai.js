import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";

const MODEL = process.env.QUOTE_MODEL || "claude-opus-5-5";

export const QuoteSchema = z.object({
  title: z.string(),
  summary: z.string(),
  line_items: z.array(
    z.object({
      description: z.string(),
      category: z.enum(["labor", "materials", "equipment", "fee", "other"]),
      quantity: z.number(),
      unit: z.string(),
      unit_price: z.number(),
    })
  ),
  scope_of_work: z.array(z.string()),
  exclusions: z.array(z.string()),
  assumptions: z.array(z.string()),
  estimated_duration: z.string(),
  terms: z.array(z.string()),
  questions_for_client: z.array(z.string()),
});

const SYSTEM = `You write job quotes for independent tradespeople and small contractors.
Turn the contractor's rough notes into a clear, professional quote their customer will trust.

Rules:
- Price in the contractor's currency using their stated hourly rate for labor. Estimate labor in quarter hours.
- If the contractor has a price book, any item in it that this job needs must be used with its exact description, unit and price.
- Material unit_price is the contractor's cost. The app adds their markup separately, so never mark materials up yourself.
- If they give material costs, use them; otherwise use realistic current retail prices for their region and say so in assumptions.
- Photos, when attached, show the job site. Use them to spot scope the notes miss, and mention anything you inferred from a photo in assumptions or questions_for_client.
- Break work into specific line items a homeowner understands. Keep labor and materials separate.
- Never invent work the notes don't support. Anything uncertain goes in assumptions or questions_for_client.
- Exclusions protect the contractor from scope creep: list the things a customer might wrongly assume are included.
- Terms: short and standard (validity period, deposit, payment timing) unless the contractor specifies their own.
- Plain, confident language. No marketing fluff.`;

// Errors whose message is safe and useful to show the contractor. Anything else (network, auth,
// rate limits from the API) gets a generic message so internal details never reach the browser.
export class QuoteError extends Error {}

let client;
export function aiEnabled() {
  return Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
}

export function buildPrompt(input, priceBook = []) {
  return [
    `Trade: ${input.trade || "general contractor"}`,
    `Business: ${input.businessName || "(not given)"}`,
    `Location: ${input.location || "(not given)"}`,
    `Currency: ${input.currency || "USD"}`,
    `Hourly labor rate: ${input.hourlyRate || "(not given - use a typical local rate and flag it)"}`,
    `Material markup: ${input.markup ?? 0}%`,
    `Contractor's own terms: ${input.terms || "(none - use standard terms)"}`,
    `Deposit to book: ${input.depositPercent ? `${input.depositPercent}% (terms must state this exact deposit)` : "(not specified)"}`,
    "",
    priceBook.length ? "Price book (reuse these exact items and prices when relevant):" : null,
    ...priceBook.map((i) => `- ${i.description} | ${i.category} | ${i.unit} | ${i.unit_price}`),
    priceBook.length ? "" : null,
    "Job notes:",
    input.notes,
  ].filter((l) => l !== null).join("\n");
}

// photos: [{ mediaType: "image/jpeg" | "image/png", data: base64 }]
export async function generateQuote(input, { priceBook = [], photos = [] } = {}) {
  if (!aiEnabled()) return demoQuote(input, priceBook);
  client ??= new Anthropic();

  const content = [
    ...photos.map((p) => ({ type: "image", source: { type: "base64", media_type: p.mediaType, data: p.data } })),
    { type: "text", text: buildPrompt(input, priceBook) },
  ];

  const response = await client.messages.parse({
    model: MODEL,
    max_tokens: 16000,
    system: SYSTEM,
    output_config: { effort: "low", format: zodOutputFormat(QuoteSchema) },
    messages: [{ role: "user", content }],
  });

  if (response.stop_reason === "refusal") throw new QuoteError("The AI declined to write this quote.");
  if (!response.parsed_output) throw new QuoteError("The AI returned an unreadable quote. Please try again.");
  return response.parsed_output;
}

// Deterministic sample used when no API key is configured, so the app is fully clickable in dev.
function demoQuote(input, priceBook = []) {
  const rate = Number(input.hourlyRate) || 85;
  return {
    title: `${input.trade ? input.trade[0].toUpperCase() + input.trade.slice(1) : "Repair"} work - estimate`,
    summary: "Demo quote (no ANTHROPIC_API_KEY set). Supply a key to generate real quotes from your notes.",
    line_items: [
      { description: "Site visit, diagnosis and setup", category: "labor", quantity: 1, unit: "hr", unit_price: rate },
      { description: "Main repair / installation work", category: "labor", quantity: 3, unit: "hr", unit_price: rate },
      { description: "Parts and fittings", category: "materials", quantity: 1, unit: "lot", unit_price: 140 },
      { description: "Disposal of old materials", category: "fee", quantity: 1, unit: "each", unit_price: 35 },
      // Mimic the real model reusing price book items the notes mention.
      ...priceBook.filter((i) => input.notes.toLowerCase().includes(i.description.toLowerCase().split(" ")[0]))
        .map((i) => ({ description: i.description, category: i.category, quantity: 1, unit: i.unit, unit_price: i.unit_price })),
    ],
    scope_of_work: ["Inspect the problem area", "Carry out the repair described in the notes", "Test and clean up"],
    exclusions: ["Repairs to drywall or finishes beyond the work area", "Permits, unless listed above"],
    assumptions: ["Clear access to the work area", "Material prices are estimates and may vary up to 10%"],
    estimated_duration: "Half a day",
    terms: ["Quote valid for 30 days", `${input.depositPercent || 50}% deposit to book, balance due on completion`],
    questions_for_client: ["Is there parking available close to the property?"],
  };
}
