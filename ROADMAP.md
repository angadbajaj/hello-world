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
- [ ] **Day 3:** Billing. Stripe Checkout and Customer Portal for Pro, a webhook that sets the plan, and plan gating. Configured by env vars; the founder adds keys.
- [ ] **Day 4:** Look professional. Logo upload, quote numbers, real PDF download, "request deposit" via a Stripe Payment Link, and email notifications on view/accept (pluggable provider).
- [ ] **Day 5:** Quality. Build an eval set of ~20 real-world job notes across trades, tune the prompt, add a price book (my saved items/rates the AI must reuse), and add photo input (snap the job, AI drafts the notes).
- [ ] **Day 6:** Distribution assets (no outreach). SEO pages per trade (`/plumber-quote-template`, etc.), a free no-login quote generator as the lead magnet, and deploy config (Dockerfile + Render/Fly guide).
- [ ] **Day 7:** Hardening + launch readiness. Security review, password reset (needs an email provider), onboarding polish, a launch checklist, and a pivot/continue decision.

## Pivot triggers (re-evaluate each session)
- If competitors already own this exact wedge at a lower price, narrow to one vertical (e.g. painters or cleaners) with vertical-specific pricing logic.
- If quoting alone looks too thin to charge for, lean into the quote → deposit → invoice payment flow (take a % or charge more).
- Adjacent fallback ideas: AI review-reply service for local businesses; AI job-ad writer for trades hiring.

## Things only the founder can do
- Get an Anthropic API key (`ANTHROPIC_API_KEY`).
- Choose hosting and a domain, and create a Stripe account (when Day 3 lands).
- Outreach and launch, when you decide. Nothing has been posted or sent anywhere.
