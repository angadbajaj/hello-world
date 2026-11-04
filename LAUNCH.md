# Launch checklist

Work top to bottom. Items marked **(you)** need your accounts or decisions; everything else is already built.

## 1. Before anyone else sees it
- [ ] **(you)** Deploy to Render using `DEPLOY.md`, and set `APP_URL` to the live URL.
- [ ] **(you)** Add `ANTHROPIC_API_KEY`, then run `npm run eval` locally (or ask me to). Fix anything that scores badly before real contractors see it.
- [ ] **(you)** Do the whole journey yourself on your phone: write a quote from notes + a photo → sign up → send → open the link in a private tab → accept → check the dashboard.
- [ ] **(you)** Set up Resend and set `RESEND_API_KEY` + `EMAIL_FROM`. Without it, password resets and alerts only go to the server's log file.
- [ ] Check `/api/health` returns `{"ok":true,"ai":true,...}` on the live site.

## 2. Before charging money
- [ ] **(you)** Stripe in **test mode**: create the Pro price and webhook (README → Setting up billing), and decide the trial length (suggestion: 14 days).
- [ ] Buy Pro with Stripe's test card `4242 4242 4242 4242`. The dashboard should flip to Pro, the logo upload should unlock, and "Made with QuoteSmith" should disappear from your quotes.
- [ ] Cancel in the billing portal. The account should drop back to Free.
- [ ] **(you)** Switch Stripe to live keys.
- [ ] **(you)** Add simple Terms of Service and Privacy Policy pages (Stripe requires them for live payments). A generator like Termly or GetTerms is fine to start.

## 3. Nice to have before telling people
- [ ] **(you)** Your own domain (e.g. `quotesmith.app`) → Render custom domain → update `APP_URL`.
- [ ] **(you)** Submit `https://YOUR_DOMAIN/sitemap.xml` in Google Search Console so the trade template pages start getting found.
- [ ] Download a backup: Render keeps daily disk snapshots, but also check you can restore one from the **Disks** tab.

## 4. Watch in the first weeks
- Signups vs quotes sent (dashboard data is in the database; I can add an admin page)
- How many quotes get **viewed** and **accepted**. That's the number the product exists to improve.
- Free users hitting the 3-quote limit: are they upgrading, or leaving?
- AI cost per quote (Anthropic console → Usage). It should be cents.

## Known limits (fine for launch, on the roadmap)
- One server with SQLite: comfortably thousands of contractors, but not multi-region.
- No email verification on signup.
- Crew plan (multiple users) isn't built, so it's shown as "coming soon" and can't be bought.
