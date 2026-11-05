# QuoteSmith

AI job quotes for tradespeople. Type rough notes and get an itemized, professional quote with a link your
customer can accept on their phone.

## Run it
Needs **Node.js 22.13 or newer** (`node -v` to check; get the LTS from https://nodejs.org). `npm start` checks this and explains if your version is too old.
```bash
npm install
ANTHROPIC_API_KEY=sk-ant-... npm start   # http://localhost:3000
```
If you leave out the key, it runs in demo mode with a sample quote.

| Env var | Default | Purpose |
|---|---|---|
| `ANTHROPIC_API_KEY` | none | Enables real AI quotes |
| `QUOTE_MODEL` | `claude-opus-5-5` | Model used for quotes |
| `PORT` | `3000` | HTTP port |
| `DATA_DIR` | `./data` | Where quotes are stored |
| `QUOTES_PER_HOUR` | `20` | Per-IP generation limit |
| `ANON_QUOTES_PER_DAY` | `2` | Quotes per IP per day without an account |
| `FREE_QUOTES_PER_MONTH` | `3` | Free-plan allowance |
| `NODE_ENV` | none | Set to `production` for secure cookies |

| `APP_URL` | request host | Public URL, used for Stripe redirect links |
| `STRIPE_SECRET_KEY` | none | Turns billing on |
| `STRIPE_PRICE_PRO` / `STRIPE_PRICE_CREW` | none | Stripe Price IDs (a plan without a price can't be bought) |
| `STRIPE_WEBHOOK_SECRET` | none | Signing secret for `/api/stripe/webhook` |
| `STRIPE_TRIAL_DAYS` | `0` | Free trial length on new subscriptions |
| `RESEND_API_KEY` | none | Sends contractor email alerts via Resend (otherwise written to `DATA_DIR/outbox.log`) |
| `FOLLOWUP_INTERVAL_MS` | `900000` | How often the Pro follow-up check runs (needs `APP_URL` in production) |
| `AUTH_ATTEMPTS_PER_15MIN` | `10` | Login/signup/reset attempts per IP |
| `EMAIL_FROM` | `QuoteSmith <alerts@quotesmith.app>` | Sender address (must be a domain verified in Resend) |

Requires Node 22.13+ (uses the built-in `node:sqlite`). Data is stored in `DATA_DIR/quotesmith.db`.

## Put it online
See **[DEPLOY.md](DEPLOY.md)**: a Render Blueprint (`render.yaml`) with a persistent disk, about 15 minutes and roughly $7/month. The `Dockerfile` also works on Fly.io, Railway or any container host, as long as a persistent volume is mounted at `/data`.

## Checking quote quality
`evals/cases.json` holds realistic job notes across trades, and `evals/checks.js` has automatic checks: the contractor's rate is used, labor is in quarter hours, price book items are reused exactly, the deposit appears in the terms, the subtotal is in a sane range, and the key scope is mentioned.
```bash
ANTHROPIC_API_KEY=sk-ant-... npm run eval          # all cases (real model calls, a few cents each)
ANTHROPIC_API_KEY=sk-ant-... npm run eval -- plumb # only cases whose id contains "plumb"
```
Results are saved to `evals/results/`. Run it before and after any prompt change.

## Setting up billing (Stripe)
1. In Stripe, create a product "QuoteSmith Pro" with a $19/month recurring price, and copy the price ID (`price_...`) into `STRIPE_PRICE_PRO`.
2. Copy your secret key into `STRIPE_SECRET_KEY`. Use test mode (`sk_test_...`) first.
3. Add a webhook endpoint at `https://YOUR_DOMAIN/api/stripe/webhook` for `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated` and `customer.subscription.deleted`, and put its signing secret in `STRIPE_WEBHOOK_SECRET`.
4. Turn on the Customer Portal (Settings → Billing → Customer portal) so customers can cancel, switch plans and update cards.
5. Local testing: `stripe listen --forward-to localhost:3000/api/stripe/webhook`.

Until these are set, the app runs normally and paid plans show as "coming soon".

## Layout
- `src/server.js`: API and routes
- `src/ai.js`: prompt, schema, Claude call
- `src/store.js`: SQLite storage (users, sessions, quotes)
- `src/billing.js`: Stripe Checkout, Customer Portal, webhook → plan
- `src/pdf.js`: server-side quote PDFs (pdfkit)
- `src/notify.js`: emails: contractor alerts, quotes and reminders to customers, password reset (Resend, or a local outbox file)
- `src/followups.js`: Pro follow-up rules (nudge after 2 days unopened / 3 days unanswered)
- `public/`: landing page (`index.html`), quote builder (`app.html`), customer view (`quote.html`), `login.html`, `dashboard.html`
- `evals/`: quote-quality cases and checks (`npm run eval`)
- `test/`: `npm test` runs the unit tests plus API tests against a real server

See `ROADMAP.md` for the plan and `LOG.md` for daily progress.
