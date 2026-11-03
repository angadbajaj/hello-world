# Putting QuoteSmith online

This gets you a live link like `https://quotesmith.onrender.com` in about 15 minutes. You don't need to install anything.
Render costs about **$7/month** for the server plus **$0.25/month** for 1 GB of storage.

## 1. Create the service on Render
1. Sign up at **https://render.com** (signing in with GitHub is easiest).
2. Click **New → Blueprint**, connect your GitHub account if asked, and pick the `hello-world` repository.
3. Render reads `render.yaml` and shows one web service called **quotesmith** with a 1 GB disk. Click **Apply**.
4. It asks for the values marked "sync: false". For a first look, you can leave everything blank except:
   - `APP_URL`: leave blank for now. You'll set it in step 2.
   - `ANTHROPIC_API_KEY`: paste your key from https://console.anthropic.com for real AI quotes. Blank means sample quotes.
5. Wait for the first deploy to finish (about 3–5 minutes). The status turns **Live**.

## 2. Set your public address
1. Copy the URL Render shows at the top of the service page (e.g. `https://quotesmith-abcd.onrender.com`).
2. Go to **Environment**, set `APP_URL` to that URL, and save. Render redeploys automatically.

Open the URL: that's your live site. Every push to `main` on GitHub redeploys it automatically.

## 3. Optional, when you're ready
| What | Where | Then set |
|---|---|---|
| Take payments | Stripe (see README → Setting up billing). The webhook URL is `APP_URL/api/stripe/webhook` | `STRIPE_SECRET_KEY`, `STRIPE_PRICE_PRO`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_TRIAL_DAYS` |
| Send email alerts | https://resend.com: add and verify your domain | `RESEND_API_KEY`, `EMAIL_FROM` (e.g. `QuoteSmith <alerts@yourdomain.com>`) |
| Your own domain | Render → Settings → Custom Domains, then add the DNS record it shows at your domain registrar | Update `APP_URL` to `https://yourdomain.com` |

## Good to know
- **Your data lives on the disk mounted at `/data`.** Don't remove the disk: deleting it deletes every account and quote. Render takes daily snapshots of disks. You can restore one from the service's **Disks** tab.
- A service with a disk can't run multiple copies at once, which is fine for this stage: one server handles thousands of contractors.
- **Logs**: the service's **Logs** tab shows errors and email/payment problems.
- **Other hosts**: the `Dockerfile` works anywhere that runs containers (Fly.io, Railway, a VPS). Whatever you use, mount a persistent volume at `/data`.
