# Build log

Each nightly session appends an entry: what shipped, what was learned, what's next.

## 2026-10-30: Day 1, MVP
**Idea chosen:** AI quote writer for tradespeople (B2B SaaS). See ROADMAP.md for the reasoning.

**Shipped**
- Express server with Claude-powered quote generation (structured JSON output via `messages.parse` + zod schema).
- Demo mode when no API key is set, so the whole app is clickable locally.
- Quote editor: editable line items, materials markup, tax, scope/exclusions/assumptions/terms, and the AI's "questions for the client".
- Customer page `/q/:id`: mobile-friendly, accept with typed name or decline, viewed timestamp, print/PDF.
- Landing page with Free/Pro/Crew pricing.
- Per-IP hourly rate limit to cap AI spend before accounts exist.
- Tests for the totals math; end-to-end browser test of create → edit → share → accept passes at phone width.

**Known gaps:** no accounts (edit access is a secret key in the URL), JSON-file storage, no billing, no notifications.
Totals labels sit too close together in the mobile editor.

**Next (Day 2):** accounts + dashboard + free-tier enforcement.

## 2026-10-30 (night): Day 2, accounts, dashboard, free tier
**Shipped**
- Email + password accounts (scrypt hashes, 30-day HttpOnly session cookies), login/signup page, logout.
- Storage moved from a JSON file to SQLite using Node's built-in `node:sqlite`, so there are no native dependencies to deploy.
- Dashboard: every quote with its live status (sent → viewed → accepted/declined), sent count, win rate, and $ won.
- Saved business profile (name, trade, rates, markup, tax, terms, phone, email). It fills in every new quote, and the phone/email appear on the customer's quote.
- Free-tier enforcement on the server: 3 quotes/month on the free plan, with a 402 + "See Pro" prompt after that. Pro/Crew are unlimited (billing sets the plan on Day 3).
- Signup funnel: try without an account (2/day per IP), and sign up inline when you hit "send". The draft is claimed into the new account and the details typed so far become the profile.
- When the owner opens their own customer link, it doesn't count as "viewed" and they get an edit/dashboard banner instead of the accept buttons.
- Tests: API integration tests (signup/claim flow, monthly cap, cross-account access, no secrets in the customer view) plus the totals tests. 5/5 pass. Playwright run of the full anonymous → signup → send → customer accepts → dashboard → logout/login flow at 390px and 1280px: no console errors, no horizontal scroll.

**Learned**
- The win-rate and "$ won" stats are the most sales-worthy screen so far. They're a concrete ROI story for the Pro upsell.
- Password reset needs an email provider. That's on the founder-decisions list; it's deferred, not forgotten.

**Next (Day 3):** Stripe billing (Checkout + Customer Portal + webhook → plan), wired to env vars so it runs when keys are added.

## 2026-10-31: Day 3, billing
**Shipped**
- Stripe billing (`src/billing.js`): Checkout for subscriptions, Customer Portal, and a signature-verified webhook that maps subscription state to the plan. `active`/`trialing` → paid plan; `past_due` → keeps access but shows "update your card"; canceled → free.
- An existing subscriber who clicks "upgrade" goes to the portal instead of a second checkout, so nobody gets double-billed.
- Dashboard Plan card: current plan/status, trial or upgrade offer, "Manage billing & invoices". Returning from Stripe polls briefly so the plan flips even if the webhook arrives after the redirect.
- Landing pricing buttons: "Start free" → app; "Go Pro" → signup/login → straight into checkout. Crew is "coming soon".
- Everything is driven by env vars. With no keys set, the app works and paid plans read "coming soon".
- Tests: 9/9 pass. New billing tests run against a local fake Stripe API: checkout params (mode, customer, price, metadata), webhook upgrade → unlimited quotes, past_due grace, cancel → free, bad signature rejected, endpoints closed when unconfigured. The Playwright pricing → signup → checkout redirect → webhook → "You're all set" flow passes at 390px and 1280px with no console errors.

**Fixed:** the dashboard kept running after redirecting a logged-out user to login, which caused a console error.

**Learned**
- Pro is now buyable, but its card promises a logo, PDF export and open/accept alerts that don't exist yet. Day 4 has to land before any real launch.

**Next (Day 4):** logo upload, quote numbers, PDF download, deposit request, and email alerts on view/accept (pluggable provider, logs to console until configured).

## 2026-11-01: Day 4, professional output (the Pro promises)
**Shipped**
- **Logo** (Pro): upload on the dashboard (PNG/JPEG only, resized in the browser, SVG refused because it can carry scripts). Shown on the customer page and the PDF while the account is on a paid plan.
- **Quote numbers**: per-account sequence starting at #1001, assigned at creation or when an anonymous draft is claimed. Shown in the editor, dashboard, customer page and PDF.
- **PDF download** (`/q/:id/pdf`, pdfkit): letter-size quote with logo, business contact, line items, totals, deposit, scope/exclusions/terms, and the acceptance stamp. Free PDFs carry a small "Made with QuoteSmith" footer.
- **Deposits**: profile has a deposit % and payment link (https only). The customer page and PDF show the deposit due. After acceptance the customer gets a "Pay deposit" button. The deposit is also passed to the AI so the written terms match.
- **Email alerts** (`src/notify.js`): accept/decline (with the customer's note) for everyone; "Jane just opened your quote" for Pro, only on the first customer open and never for the owner's own preview. Sends via Resend when keyed, otherwise to `data/outbox.log`.
- Pricing copy now matches what exists: Free includes PDF + accept emails; Pro is unlimited + logo + no branding + open alerts.
- Tests: 15/15 pass (new: numbering incl. claimed drafts, deposit/link validation, logo gating/validation/serving, PDF access rules, alert rules). Playwright run of Pro logo upload → profile deposit → quote → PDF → customer opens (logo renders, no branding) → accepts → "Pay deposit": passes at 390px and 1280px with no console errors.

**Fixed**
- Materials showed their pre-markup unit price next to a marked-up total ("1 × $18.50 = $21.28"). Customers now see the marked-up unit price, on the web and in the PDF.
- The branded PDF footer pushed onto a blank second page.

**Learned**
- Every Pro claim on the pricing page now exists. Nothing is advertised that isn't built.
- The "Made with QuoteSmith" footer on free quotes is our only zero-cost acquisition channel. Keep it tasteful, and keep it.

**Next (Day 5):** quote quality. Build an eval set of real-world job notes across trades, tune the prompt, add a price book the AI reuses, and photo input.
