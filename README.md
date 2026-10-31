# QuoteSmith

AI job quotes for tradespeople. Type rough notes and get an itemized, professional quote with a link your
customer can accept on their phone.

## Run it
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

Requires Node 22.13+ (uses the built-in `node:sqlite`). Data is stored in `DATA_DIR/quotesmith.db`.

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
- `public/`: landing page (`index.html`), quote builder (`app.html`), customer view (`quote.html`), `login.html`, `dashboard.html`
- `test/`: `npm test` runs the unit tests plus API tests against a real server

See `ROADMAP.md` for the plan and `LOG.md` for daily progress.
