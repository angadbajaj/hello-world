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

## 2026-11-02: Day 5, quote quality
**Shipped**
- **Price book**: a dashboard section to add/edit/delete standard items (description, type, unit, price; max 200 per account). Every quote request sends it to the AI, which must reuse matching items with their exact description and price. Each line in the quote editor has a ☆ button to save it to the price book, so it fills up as contractors work.
- **Job photos**: attach up to 3 photos (they open the phone camera on mobile, are downscaled in the browser, and are sent to Claude as images). Photos alone are enough to start a quote. Photo data is never stored, only the count.
- **Prompt rules**: labor in quarter hours; material prices are cost, so the AI must not add markup itself (the app applies it, which could otherwise double-count); reuse the price book verbatim; mention anything inferred from photos.
- **Mobile-first quote form**: customer → notes → photos → button. The business details and rates sit in a collapsible "Your business & rates" section, closed for returning users with a one-line summary.
- **Eval set** (`evals/`): 16 realistic cases across plumbing, electrical, painting, HVAC, handyman, cleaning, landscaping, roofing, a UK/GBP job, deliberately vague notes, and a missing rate, scored by automatic checks. `npm run eval` runs them against the real model and saves the results.
- **Node version check**: `npm start` now prints a clear "needs Node 22.13+" message with the fix (`.nvmrc` and `engines` added too). This was prompted by the founder hitting an old Node locally.
- Tests: 20/20 pass (new: price book CRUD/isolation/reuse, photo validation and cap, eval cases well-formed, checks pass a good quote and catch each mistake). Also fixed a flaky test port collision by using OS-assigned ports. Playwright run of add/edit price book → quote with photos → price-book item at the edited price → ☆ save a line: passes at 390px and 1280px with no console errors, and the Day 2 and Day 4 flows still pass.

**Learned**
- I can't judge real quote quality without an API key. The harness is ready, but its first real run is the most valuable next step for the product.
- The founder wants to *see* the product, so a live link matters more right now than more features.

**Next (Day 6):** Render deploy blueprint + guide, then per-trade SEO pages.

## 2026-11-03: Day 6, deployable + search pages
**Shipped**
- **Deploy kit**: a `Dockerfile` (Node 22, production deps only, runs as a non-root user, data on a `/data` volume, built-in health check), `render.yaml` (one web service plus a 1 GB persistent disk, secrets prompted at setup), and `DEPLOY.md`, a click-by-click guide for a non-developer, including how not to lose data.
- **Production hardening**: security headers (nosniff, DENY framing, referrer policy, HSTS in production), no `x-powered-by`, `/api/health` actually checks the database, and SIGTERM finishes in-flight requests and closes SQLite cleanly so redeploys don't corrupt data.
- **Verified like the image would run**: Docker Hub and the ECR mirror are blocked from this sandbox, so I couldn't build the image itself. I reproduced it instead: the same files, a clean `npm ci --omit=dev`, run as `nobody` with `NODE_ENV=production` and the data dir as the volume. Signup → quote → SIGTERM (clean exit) → restart → login: the account and quote were still there. Cookies had `Secure` and HSTS was present.
- **8 trade template pages** (plumbing, electrical, painting, handyman, HVAC, roofing, landscaping, cleaning): what to include, a worked example with realistic line items (labeled as example figures), trade-specific exclusions, 2 FAQs with FAQPage structured data, and a CTA into `/app?trade=…`, which pre-fills the trade. Plus an index page, `sitemap.xml`, `robots.txt` (blocks `/q/` customer quotes, `/api/`, dashboard), `noindex` on the quote page, and canonical URLs from `APP_URL`.
- Tests: 23/23 pass (new: every trade page renders with its correct subtotal, canonical, FAQ schema and CTA; 404 for unknown trades; sitemap/robots; security headers). Playwright run of landing → trade page → index → plumber → CTA → prefilled generator → quote: passes at 390px and 1280px with no console errors and no horizontal scroll. The Day 4 and Day 5 flows still pass.

**Learned**
- Getting the product online is now a 15-minute job for the founder, not an engineering task.

**Next (Day 7):** security review, password reset (dev outbox until Resend is keyed), onboarding polish, launch checklist, week-in-review, and the pivot/continue call.

## 2026-11-04: Day 7, security, password reset, onboarding, launch plan
**Security review** (read every route; fixed what mattered):
- AI-provider failures returned the SDK's raw error text to the browser. Now only our own safe messages are shown, and everything else gets "The quote service is busy right now…". Tested by pointing the SDK at a dead port.
- Added a Content-Security-Policy (`default-src 'self'`, no objects, no framing, no third-party scripts). Every browser flow from days 2–6 was re-run under it with zero console errors.
- Login for an unknown email skipped the password hash, so its timing revealed which emails have accounts. It now always hashes.
- Saved quotes rejected nothing numeric. Negative or absurd quantities/prices and >200 lines are now refused.
- Rate-limiter memory grew forever, and expired sessions were never deleted. Both are now purged every 10 minutes.
- Reviewed and OK: cookies (HttpOnly, SameSite=Lax, Secure in prod), cross-account access (tests), customer view hides secrets, all HTML output escaped, logo/photo types restricted, webhook signatures verified, open-redirect guard on `?next=`.
- Accepted risks (noted in LAUNCH.md): no email verification at signup; signup says "email already has an account" (normal UX, minor enumeration).

**Password reset**: "Forgot your password?" on login → emailed link (outbox until Resend is keyed). Tokens are random, stored only as SHA-256 hashes, single-use, expire in 1 hour, and are stripped from the address bar on load. Resetting signs the account out everywhere. Same response whether or not the email exists.

**Onboarding**: the "Get set up" checklist on the dashboard covers business name + rate → first quote sent → 3 price book items → deposit + payment link. It updates live and disappears when done.

**Launch**: `LAUNCH.md` is an ordered checklist split into what's built vs what needs the founder.

**Decision**: continue, but reposition from "AI writes quotes" (crowded: many 2026 AI estimator apps from ~$8/mo, Joist ~$10–32) to "win more of the jobs you quote" (accept link, open alerts, deposits, follow-ups, win rate). Full reasoning and the week-2 plan are in ROADMAP.md.

Tests: 27/27 pass (new: reset flow incl. enumeration-safety, single use and session revocation; numeric validation; CSP; generic AI errors). Playwright: checklist progress + forgot → email link → new password → reused-link error at 390px and 1280px with no console errors. All earlier flows (days 2–6) still pass under the CSP.

**Next (Day 8):** automatic follow-ups for unopened/unanswered quotes.

## 2026-11-05: Day 8, follow-ups and emailing quotes ("win the job")
**Shipped**
- **Email quote** (all plans): a customer email field on the quote form, plus "Email quote" after saving. It goes out as "Smith Plumbing via QuoteSmith", replies go straight to the contractor, and resending within 10 minutes is blocked. Before this, contractors had to copy the link and text it themselves.
- **Automatic follow-ups** (Pro, `src/followups.js`, every 15 minutes): one email to the contractor when a quote hasn't been opened after 2 days ("It may be in spam, a quick call usually gets it seen"), and one when it was opened but not answered after 3 days ("this is the best moment to call"). If the contractor opts in and the quote has the customer's email, the customer gets **one** friendly reminder from the contractor, never more. Quotes older than 30 days are left alone. In production it only runs once `APP_URL` is set, so links are never broken.
- **Follow-up badges** on the dashboard for every plan ("Follow up: not opened yet / opened, no answer"). Free users see who to chase; Pro chases for them.
- **Privacy**: the customer's email and the follow-up bookkeeping are stripped from the public quote.
- **Positioning**: landing hero is now "Win more of the jobs you quote."; Free/Pro copy updated to match what exists.
- Tests: 31/31 pass (new: follow-up rules with a controlled clock: timing, one-time nudges, the single customer reminder, free/opt-out/no-email/stale cases; email-quote auth, rate limit, sender/reply-to and privacy). Playwright run of Pro opt-in → quote with customer email → Email quote → dashboard follow-up badge at 390px and 1280px with no console errors; all earlier flows still pass.

**Learned**
- Emailing the quote straight from QuoteSmith is the missing half of "speed to quote". It also means we can see whether the customer received it, which is what makes follow-ups possible.

**Next:** the final scheduled run writes the week-in-review and turns off the nightly schedule.
