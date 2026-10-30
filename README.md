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

Requires Node 22.13+ (uses the built-in `node:sqlite`). Data is stored in `DATA_DIR/quotesmith.db`.

## Layout
- `src/server.js`: API and routes
- `src/ai.js`: prompt, schema, Claude call
- `src/store.js`: SQLite storage (users, sessions, quotes)
- `public/`: landing page (`index.html`), quote builder (`app.html`), customer view (`quote.html`), `login.html`, `dashboard.html`
- `test/`: `npm test` runs the unit tests plus API tests against a real server

See `ROADMAP.md` for the plan and `LOG.md` for daily progress.
