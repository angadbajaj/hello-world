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
