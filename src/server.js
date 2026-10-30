import express from "express";
import path from "node:path";
import { generateQuote, aiEnabled, QuoteSchema } from "./ai.js";
import { createQuote, getQuote, updateQuote, publicView } from "./store.js";

const app = express();
const PUBLIC = path.resolve("public");
app.use(express.json({ limit: "200kb" }));
app.use(express.static(PUBLIC, { extensions: ["html"] }));

// Naive per-IP limiter to stop a runaway bill before accounts exist.
const hits = new Map();
function rateLimit(req, res, next) {
  const now = Date.now();
  const recent = (hits.get(req.ip) || []).filter((t) => now - t < 60 * 60 * 1000);
  if (recent.length >= Number(process.env.QUOTES_PER_HOUR || 20)) {
    return res.status(429).json({ error: "Hourly quote limit reached. Try again later." });
  }
  hits.set(req.ip, [...recent, now]);
  next();
}

const str = (v, max) => (typeof v === "string" ? v.trim().slice(0, max) : "");

app.get("/api/health", (req, res) => res.json({ ok: true, ai: aiEnabled() }));

app.post("/api/quotes", rateLimit, async (req, res) => {
  const b = req.body || {};
  const input = {
    trade: str(b.trade, 60),
    businessName: str(b.businessName, 120),
    location: str(b.location, 120),
    currency: str(b.currency, 8) || "USD",
    hourlyRate: Number(b.hourlyRate) || "",
    markup: Number(b.markup) || 0,
    taxRate: Number(b.taxRate) || 0,
    terms: str(b.terms, 2000),
    notes: str(b.notes, 6000),
    customerName: str(b.customerName, 120),
  };
  if (input.notes.length < 15) return res.status(400).json({ error: "Add a few more details about the job." });
  try {
    const quote = await generateQuote(input);
    const record = createQuote({ input, quote });
    res.json(record);
  } catch (err) {
    console.error(err);
    res.status(502).json({ error: err.message || "Quote generation failed." });
  }
});

// Owner-only: requires the edit key returned at creation.
app.get("/api/quotes/:id/edit", (req, res) => {
  const q = getQuote(req.params.id);
  if (!q || q.editKey !== req.query.key) return res.status(404).json({ error: "Not found" });
  res.json(q);
});

app.put("/api/quotes/:id", (req, res) => {
  const q = getQuote(req.params.id);
  if (!q || q.editKey !== req.body?.key) return res.status(404).json({ error: "Not found" });
  const parsed = QuoteSchema.safeParse(req.body.quote);
  if (!parsed.success) return res.status(400).json({ error: "Invalid quote data" });
  const taxRate = Number(req.body.taxRate);
  const input = { ...q.input, taxRate: Number.isFinite(taxRate) ? taxRate : q.input.taxRate };
  res.json(updateQuote(q.id, { quote: parsed.data, input, status: q.status === "draft" ? "sent" : q.status }));
});

// Customer-facing.
app.get("/api/q/:id", (req, res) => {
  const q = getQuote(req.params.id);
  if (!q || q.status === "draft") return res.status(404).json({ error: "Quote not found" });
  if (!q.viewedAt) updateQuote(q.id, { viewedAt: new Date().toISOString() });
  res.json(publicView(q));
});

app.post("/api/q/:id/respond", (req, res) => {
  const q = getQuote(req.params.id);
  if (!q || q.status === "draft") return res.status(404).json({ error: "Quote not found" });
  if (q.status === "accepted" || q.status === "declined") return res.status(409).json({ error: `Already ${q.status}` });
  const decision = req.body?.decision === "accept" ? "accepted" : "declined";
  const updated = updateQuote(q.id, {
    status: decision,
    respondedAt: new Date().toISOString(),
    signature: str(req.body?.name, 120),
    customerNote: str(req.body?.note, 1000),
  });
  res.json(publicView(updated));
});

app.get("/q/:id", (req, res) => res.sendFile(path.join(PUBLIC, "quote.html")));

const port = Number(process.env.PORT || 3000);
app.listen(port, () => console.log(`QuoteSmith on http://localhost:${port} (AI ${aiEnabled() ? "on" : "demo mode"})`));
