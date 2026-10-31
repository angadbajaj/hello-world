import express from "express";
import path from "node:path";
import { generateQuote, aiEnabled, QuoteSchema } from "./ai.js";
import * as store from "./store.js";
import * as billing from "./billing.js";

const app = express();
const PUBLIC = path.resolve("public");
const PROD = process.env.NODE_ENV === "production";
const PLAN_LIMITS = { free: Number(process.env.FREE_QUOTES_PER_MONTH || 3), pro: Infinity, crew: Infinity };

app.set("trust proxy", 1);

// Stripe needs the raw body to verify the signature, so this route comes before the JSON parser.
app.post("/api/stripe/webhook", express.raw({ type: "application/json", limit: "1mb" }), (req, res) => {
  if (!billing.billingStatus().enabled || !process.env.STRIPE_WEBHOOK_SECRET) return res.status(503).json({ error: "Billing not configured" });
  try {
    res.json({ received: billing.handleWebhook(req.body, req.headers["stripe-signature"]) });
  } catch (err) {
    console.error("stripe webhook:", err.message);
    res.status(400).json({ error: "Invalid webhook" });
  }
});

app.use(express.json({ limit: "200kb" }));
app.use(express.static(PUBLIC, { extensions: ["html"] }));

// ---- helpers ----

function limiter(name, max, windowMs) {
  const hits = new Map();
  return (req, res, next) => {
    const now = Date.now();
    const recent = (hits.get(req.ip) || []).filter((t) => now - t < windowMs);
    if (recent.length >= max) return res.status(429).json({ error: `Too many ${name}. Try again later.` });
    hits.set(req.ip, [...recent, now]);
    next();
  };
}
const quoteLimiter = limiter("quotes", Number(process.env.QUOTES_PER_HOUR || 20), 3600e3);
const anonLimiter = limiter("quotes without an account. Sign up free to keep going", Number(process.env.ANON_QUOTES_PER_DAY || 2), 864e5);
const authLimiter = limiter("login attempts", 10, 15 * 60e3);

const str = (v, max) => (typeof v === "string" ? v.trim().slice(0, max) : "");

const COOKIE = "qs_session";
function readCookie(req, name) {
  for (const part of (req.headers.cookie || "").split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return decodeURIComponent(v.join("="));
  }
  return null;
}
function setSession(res, userId) {
  const { token, maxAge } = store.createSession(userId);
  res.setHeader("Set-Cookie", `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${PROD ? "; Secure" : ""}`);
}

app.use((req, res, next) => {
  req.user = store.userForSession(readCookie(req, COOKIE));
  next();
});
const requireUser = (req, res, next) => (req.user ? next() : res.status(401).json({ error: "Please log in." }));

function usage(user) {
  const limit = PLAN_LIMITS[user.plan] ?? PLAN_LIMITS.free;
  return { used: store.quotesThisMonth(user.id), limit: Number.isFinite(limit) ? limit : null };
}
function overLimit(user) {
  const u = usage(user);
  return u.limit !== null && u.used >= u.limit;
}
const LIMIT_ERROR = { error: "You've used all your free quotes this month. Upgrade to Pro for unlimited quotes.", upgrade: true };

const canEdit = (q, req, key) => q && ((req.user && q.userId === req.user.id) || (!q.userId && key && key === q.editKey));

// ---- auth ----

app.post("/api/signup", authLimiter, (req, res) => {
  const email = str(req.body?.email, 200);
  const password = typeof req.body?.password === "string" ? req.body.password : "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: "Enter a valid email." });
  if (password.length < 8) return res.status(400).json({ error: "Password must be at least 8 characters." });
  const user = store.createUser(email, password);
  if (!user) return res.status(409).json({ error: "That email already has an account. Log in instead." });
  setSession(res, user.id);
  res.json({ user, usage: usage(user) });
});

app.post("/api/login", authLimiter, (req, res) => {
  const user = store.verifyUser(str(req.body?.email, 200), String(req.body?.password || ""));
  if (!user) return res.status(401).json({ error: "Wrong email or password." });
  setSession(res, user.id);
  res.json({ user, usage: usage(user) });
});

app.post("/api/logout", (req, res) => {
  const token = readCookie(req, COOKIE);
  if (token) store.deleteSession(token);
  res.setHeader("Set-Cookie", `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
  res.json({ ok: true });
});

app.get("/api/me", (req, res) => res.json(req.user ? { user: req.user, usage: usage(req.user), billing: billing.billingStatus() } : { user: null }));

const PROFILE_FIELDS = { trade: 60, businessName: 120, location: 120, currency: 8, terms: 2000, phone: 40, email: 200 };
const PROFILE_NUMBERS = ["hourlyRate", "markup", "taxRate"];
app.put("/api/me/profile", requireUser, (req, res) => {
  const b = req.body || {};
  const profile = {};
  for (const [k, max] of Object.entries(PROFILE_FIELDS)) profile[k] = str(b[k], max);
  for (const k of PROFILE_NUMBERS) profile[k] = Number(b[k]) || 0;
  res.json({ user: store.updateProfile(req.user.id, profile) });
});

// ---- quotes (contractor side) ----

app.get("/api/health", (req, res) => res.json({ ok: true, ai: aiEnabled(), billing: billing.billingStatus().enabled }));

// ---- billing ----

const origin = (req) => process.env.APP_URL || `${req.protocol}://${req.get("host")}`;

app.post("/api/billing/checkout", requireUser, async (req, res) => {
  const plan = req.body?.plan;
  if (!billing.canCheckout(plan)) return res.status(503).json({ error: "Upgrades aren't available yet. Check back soon." });
  if (req.user.plan === plan) return res.status(409).json({ error: `You're already on ${plan}.` });
  try {
    // Existing subscribers switch plans in the portal so they aren't billed twice.
    const switching = req.user.plan !== "free" && req.user.stripeCustomerId;
    res.json({ url: switching ? await billing.createPortal(req.user, origin(req)) : await billing.createCheckout(req.user, plan, origin(req)) });
  } catch (err) {
    console.error("checkout:", err.message);
    res.status(502).json({ error: "Couldn't start checkout. Please try again." });
  }
});

app.post("/api/billing/portal", requireUser, async (req, res) => {
  if (!billing.billingStatus().enabled || !req.user.stripeCustomerId) return res.status(400).json({ error: "No billing account yet." });
  try {
    res.json({ url: await billing.createPortal(req.user, origin(req)) });
  } catch (err) {
    console.error("portal:", err.message);
    res.status(502).json({ error: "Couldn't open billing. Please try again." });
  }
});

app.get("/api/quotes", requireUser, (req, res) => {
  res.json({ quotes: store.listQuotes(req.user.id), usage: usage(req.user) });
});

app.post("/api/quotes", quoteLimiter, (req, res, next) => (req.user ? next() : anonLimiter(req, res, next)), async (req, res) => {
  if (req.user && overLimit(req.user)) return res.status(402).json(LIMIT_ERROR);
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
    contactPhone: req.user?.profile.phone || "",
    contactEmail: req.user?.profile.email || "",
  };
  if (input.notes.length < 15) return res.status(400).json({ error: "Add a few more details about the job." });
  try {
    const quote = await generateQuote(input);
    res.json(store.createQuote({ input, quote, userId: req.user?.id }));
  } catch (err) {
    console.error(err);
    res.status(502).json({ error: err.message || "Quote generation failed." });
  }
});

app.get("/api/quotes/:id/edit", (req, res) => {
  const q = store.getQuote(req.params.id);
  if (!canEdit(q, req, req.query.key)) return res.status(404).json({ error: "Not found" });
  res.json(q);
});

// Saving makes the quote shareable, so it needs an account. Saving an anonymous draft claims it.
app.put("/api/quotes/:id", requireUser, (req, res) => {
  const q = store.getQuote(req.params.id);
  if (!canEdit(q, req, req.body?.key)) return res.status(404).json({ error: "Not found" });
  const parsed = QuoteSchema.safeParse(req.body.quote);
  if (!parsed.success) return res.status(400).json({ error: "Invalid quote data" });
  const patch = {};
  if (!q.userId) {
    if (overLimit(req.user)) return res.status(402).json(LIMIT_ERROR);
    Object.assign(patch, { userId: req.user.id, claimedAt: new Date().toISOString() });
  }
  const taxRate = Number(req.body.taxRate);
  const input = { ...q.input, taxRate: Number.isFinite(taxRate) ? taxRate : q.input.taxRate };
  if (!input.contactPhone && !input.contactEmail) {
    Object.assign(input, { contactPhone: req.user.profile.phone || "", contactEmail: req.user.profile.email || "" });
  }
  Object.assign(patch, { quote: parsed.data, input, status: q.status === "draft" ? "sent" : q.status });
  res.json(store.updateQuote(q.id, patch));
});

// ---- customer side ----

app.get("/api/q/:id", (req, res) => {
  const q = store.getQuote(req.params.id);
  if (!q || q.status === "draft") return res.status(404).json({ error: "Quote not found" });
  const isOwner = req.user && req.user.id === q.userId;
  if (!q.viewedAt && !isOwner) store.updateQuote(q.id, { viewedAt: new Date().toISOString() });
  res.json({ ...store.publicView(q), isOwner: Boolean(isOwner) });
});

app.post("/api/q/:id/respond", (req, res) => {
  const q = store.getQuote(req.params.id);
  if (!q || q.status === "draft") return res.status(404).json({ error: "Quote not found" });
  if (q.status === "accepted" || q.status === "declined") return res.status(409).json({ error: `Already ${q.status}` });
  const decision = req.body?.decision === "accept" ? "accepted" : "declined";
  const updated = store.updateQuote(q.id, {
    status: decision,
    respondedAt: new Date().toISOString(),
    signature: str(req.body?.name, 120),
    customerNote: str(req.body?.note, 1000),
  });
  res.json(store.publicView(updated));
});

app.get("/q/:id", (req, res) => res.sendFile(path.join(PUBLIC, "quote.html")));

const port = Number(process.env.PORT || 3000);
app.listen(port, () => console.log(`QuoteSmith on http://localhost:${port} (AI ${aiEnabled() ? "on" : "demo mode"})`));
