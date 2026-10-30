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

## Layout
- `src/server.js`: API and routes
- `src/ai.js`: prompt, schema, Claude call
- `src/store.js`: storage
- `public/`: landing page (`index.html`), quote builder (`app.html`), customer view (`quote.html`)

See `ROADMAP.md` for the plan and `LOG.md` for daily progress.
