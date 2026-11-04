# QuoteSmith: product plan

## The bet
Independent tradespeople (plumbers, electricians, painters, handymen, cleaners, landscapers) lose jobs
because quoting is slow and they hate paperwork. Most still send quotes as a text message or a Word
document days later, and the first professional quote to arrive usually wins the job.

QuoteSmith turns rough notes into an itemized, professional quote in about 60 seconds, and the customer
gets a link they can accept on their phone.

**Why this can make steady income:**
- B2B SaaS with a clear ROI. One extra job won pays for a year of Pro.
- Huge, fragmented market (millions of owner-operators in the US, UK, Canada and Australia) that big field-service suites ($100-300/mo) overserve.
- Low running cost. One quote costs a few cents of AI.
- Sticky once their rates, terms and customers are in it. The natural expansion path is quote, then deposit, then invoice.

**Pricing hypothesis:** Free (3 quotes/mo) → Pro $19/mo → Crew $49/mo.

## Week 1 build plan (one focus per nightly session)
- [x] **Day 1 (Oct 30):** MVP. Notes to AI quote, editor, totals and tax, shareable customer link, accept/decline with name, print to PDF, landing page with pricing.
- [x] **Day 2 (Oct 30, night):** Accounts (email + password, sessions), a dashboard with status (sent/viewed/accepted) and win-rate stats, server-side enforcement of 3 free quotes/month, and a saved business profile. Also pulled the SQLite move forward from Day 7 (built-in `node:sqlite`, no native deps) because accounts needed real tables.
  - *Funnel decision:* anyone can generate a quote with no signup (2/day per IP), but sending it to a customer requires a free account. They get value first and sign up at the moment it matters.
- [x] **Day 3 (Oct 31):** Billing. Stripe Checkout + Customer Portal, a signed webhook that sets the plan (past_due keeps access as a grace period; cancel drops to free), an optional free trial (`STRIPE_TRIAL_DAYS`), a Plan card on the dashboard, and pricing buttons that go signup → checkout in one path.
  - *Decision:* Crew is marked "coming soon" and can't be bought until its features exist; selling features we don't have creates refunds and churn. **Day 4 is now launch-blocking**, because the Pro card promises a logo, PDF export and open/accept alerts.
- [x] **Day 4 (Nov 1):** Look professional. Logo upload (Pro), per-account quote numbers (#1001...), server-rendered PDF download, deposit % plus "Pay deposit" button after acceptance (the contractor's own payment link), and email alerts: accept/decline for everyone, "customer just opened your quote" for Pro.
  - *Decision:* PDF download is free for everyone, since print-to-PDF already was. Pro is differentiated by **branding** (logo, no "Made with QuoteSmith") and **open alerts**, both visible to the contractor's customers or felt every day. Free PDFs and quote pages carry "Made with QuoteSmith", which turns every free quote a customer sees into a small ad.
  - *Deferred:* taking deposits through Stripe Connect. It would let us earn a % of deposits, the biggest revenue lever after subscriptions, but it adds KYC/onboarding work. It's a strong week-2 candidate once there are real users.
- [x] **Day 5 (Nov 2):** Quality. Price book (saved items and prices the AI must reuse exactly; ☆ any quote line to save it), job photos sent to the AI, a mobile-first quote form, a 16-case eval set with automatic checks (`npm run eval`), and tighter prompt rules (quarter-hour labor, never mark up materials itself since the app applies markup, use the price book verbatim).
  - *Blocked:* actually **scoring and tuning** the prompt needs an Anthropic API key. The harness is ready; the first run should happen as soon as a key exists.
  - *Re-prioritized:* the founder tried to run the app locally and hit an old Node.js. `npm start` now checks the version and explains the fix. Being able to *see* the product clearly matters, so Day 6 leads with hosting config.
- [x] **Day 6 (Nov 3):** Deploy: `Dockerfile`, a Render Blueprint (`render.yaml`) with a 1 GB persistent disk, and a plain-English `DEPLOY.md` (about 15 minutes, ~$7/month). Production hardening: security headers, HSTS, health check that pings the DB, and graceful shutdown on SIGTERM. Distribution (no outreach): 8 per-trade quote template pages (`/quote-template/plumber`, ...) with a worked example, FAQ (with FAQ schema), and a CTA that pre-fills the generator with that trade; an index page, `sitemap.xml`, `robots.txt` (customer quote links are `noindex`), and landing-page links to all of them.
  - *Why these pages:* contractors search "plumbing quote template" when they need to send one. These pages answer that query honestly and hand off to the free generator at the moment of need. It's the cheapest durable acquisition channel and needs no outreach.
- [x] **Day 7 (Nov 4):** Security review and fixes (generic AI errors, CSP, timing-safe login, line-item limits, limiter/session cleanup), password reset (hashed single-use tokens, 1 hour, signs out all sessions, no email enumeration), a first-run "Get set up" checklist on the dashboard, `LAUNCH.md`, and the continue/pivot decision below.
- [ ] **Day 8 (Nov 5):** Automatic follow-ups (Pro): if a sent quote hasn't been opened in 2 days, or opened but not answered in 3, nudge the contractor ("call Jane now") and optionally send the customer one polite reminder from the contractor. This directly raises win rate, which is the number we sell.

## Decision after week 1 (Nov 4): continue, and reposition
**What I checked:** the market for "AI writes your estimate" is crowded. In 2026 alone there are many App Store apps (Trade Estimate AI, ContractorIQ at ~$8/mo, Estimr, SimplyWise, QuoteDrop, and others), and Joist covers basic quoting at about $10–32/mo. Field-service suites (Jobber from ~$29–49, Housecall Pro from ~$59–79) bundle estimates with scheduling. (Third-party pricing figures; vendors weren't checked directly.)

**So "AI writes the quote" is not a moat on its own.** Our pivot trigger ("competitors own this wedge at a lower price") is partly met for the *writing* part.

**Why continue anyway:** none of the cheap AI estimators I found close the loop the way QuoteSmith already does: a customer link with one-tap acceptance, "they just opened it" alerts, deposits on acceptance, and win-rate tracking. It's web-based, so there's no app install for the contractor or the customer. That's a different promise: **win more of the jobs you quote**, not "write quotes faster".

**What changes:**
1. **Positioning:** the landing page and trade pages lead with winning jobs (speed to quote → follow-up → acceptance → deposit). AI writing is the means, not the headline.
2. **Next features build the moat on the "after you send it" side:** automatic follow-ups (Day 8), Stripe Connect deposits (QuoteSmith takes a small % on top of the subscription), then quote → invoice.
3. **Price stays at $19/mo Pro** for now. It sits between the $8 AI apps and the $50+ suites, and is justified by measurable wins (the dashboard's win rate and $ won).
4. **Pivot signal to watch after launch:** if contractors use it to write quotes but rarely send the customer link, the follow-up/acceptance loop isn't valued. Then narrow to one trade where we can win on trade-specific pricing, or move to the adjacent "AI follow-up/booking assistant for trades" idea.

## Week 2 plan (proposed)
- Automatic follow-ups (Pro), started Day 8
- Stripe Connect deposits (platform fee), replacing "paste your own payment link"
- Quote → invoice in one tap after the job
- First real eval run + prompt tuning (needs the API key)
- Landing page rewrite around "win the job"
- Small admin page: signups, quotes sent/viewed/accepted, upgrades

## Pivot triggers (re-evaluate each session)
- If competitors already own this exact wedge at a lower price, narrow to one vertical (e.g. painters or cleaners) with vertical-specific pricing logic.
- If quoting alone looks too thin to charge for, lean into the quote → deposit → invoice payment flow (take a % or charge more).
- Adjacent fallback ideas: AI review-reply service for local businesses; AI job-ad writer for trades hiring.

## Things only the founder can do
- Get an Anthropic API key (`ANTHROPIC_API_KEY`).
- Put it online: follow DEPLOY.md (Render, ~15 minutes). Later, a domain.
- Create a Stripe account plus the Pro product/price and webhook (steps in README → Setting up billing). Decide on a free-trial length (my suggestion: 14 days).
- Pick an email provider (Resend or Postmark) for alerts and password reset.
- Outreach and launch, when you decide. Nothing has been posted or sent anywhere.
