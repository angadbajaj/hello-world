import { TRADES, tradeBySlug } from "./trades.js";

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const usd = (n) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

function page({ title, description, path, body, jsonLd, base }) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(description)}" />
  ${base ? `<link rel="canonical" href="${esc(base + path)}" />` : ""}
  <meta property="og:title" content="${esc(title)}" />
  <meta property="og:description" content="${esc(description)}" />
  <link rel="stylesheet" href="/style.css" />
  ${jsonLd ? `<script type="application/ld+json">${JSON.stringify(jsonLd).replace(/</g, "\\u003c")}</script>` : ""}
</head>
<body>
  <div class="wrap">
    <header class="top"><a class="logo" href="/">Quote<span>Smith</span></a><nav id="nav"><a class="btn" href="/app">Write a quote free</a></nav></header>
    ${body}
    <footer><a href="/">QuoteSmith</a> · <a href="/quote-template">Quote templates by trade</a></footer>
  </div>
  <script type="module">import { renderNav } from "/nav.js"; renderNav();</script>
</body>
</html>`;
}

export function tradePage(slug, base) {
  const t = tradeBySlug[slug];
  if (!t) return null;
  const items = t.example.items.map(([description, category, qty, unit, price]) => ({ description, category, qty, unit, price }));
  const subtotal = items.reduce((s, i) => s + i.qty * i.price, 0);
  const cta = `<a class="btn" href="/app?trade=${encodeURIComponent(t.trade)}">Write my ${esc(t.name.toLowerCase())} quote free</a>`;
  const body = `
    <article class="seo">
      <p class="muted">Free template for ${esc(t.who)}</p>
      <h1>${esc(t.name)} quote template</h1>
      <p class="lead">${esc(t.intro)}</p>
      <div class="row">${cta}<span class="muted">No signup to try. Rough notes in, finished quote out.</span></div>

      <h2>What to include in a ${esc(t.name.toLowerCase())} quote</h2>
      <ul>${t.includes.map((i) => `<li>${esc(i)}</li>`).join("")}</ul>

      <h2>Example: ${esc(t.example.title)}</h2>
      <p class="muted">Example figures at ${usd(t.example.rate)}/hr. Your rates and prices will differ.</p>
      <div class="card">
        <table class="items"><thead><tr><th>Item</th><th class="num">Qty</th><th class="num">Price</th><th class="num">Total</th></tr></thead>
          <tbody>${items.map((i) => `<tr><td>${esc(i.description)}</td><td class="num">${i.qty} ${esc(i.unit)}</td>
            <td class="num">${usd(i.price)}</td><td class="num">${usd(i.qty * i.price)}</td></tr>`).join("")}</tbody></table>
        <div class="totals" style="margin-top:12px"><div class="grand"><span>Subtotal</span><span>${usd(subtotal)}</span></div></div>
        <h3>Not included</h3>
        <ul>${t.example.exclusions.map((e) => `<li>${esc(e)}</li>`).join("")}</ul>
      </div>

      <h2>Common questions</h2>
      ${t.faq.map(([q, a]) => `<h3>${esc(q)}</h3><p>${esc(a)}</p>`).join("")}

      <div class="card cta-card">
        <h2 style="margin-top:0">Skip the template: let QuoteSmith write it</h2>
        <p class="muted">Type your notes the way you'd text them, or snap a photo of the job. You get an itemized quote with scope, exclusions and terms at your rates, and a link your customer can accept on their phone.</p>
        ${cta}
      </div>

      <p class="muted">Other trades: ${TRADES.filter((x) => x.slug !== slug).map((x) => `<a href="/quote-template/${x.slug}">${esc(x.name)}</a>`).join(" · ")}</p>
    </article>`;
  return page({
    title: `Free ${t.name} Quote Template (with Example) | QuoteSmith`,
    description: `What to put in a ${t.name.toLowerCase()} quote, a worked example with line items, and a free tool that writes the quote from your job notes.`,
    path: `/quote-template/${slug}`,
    base,
    body,
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: t.faq.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })),
    },
  });
}

export function indexPage(base) {
  const body = `
    <article class="seo">
      <h1>Free quote templates by trade</h1>
      <p class="lead">What to include, a worked example, and a free generator for each trade.</p>
      <div class="features">${TRADES.map((t) => `<a class="card trade-link" href="/quote-template/${t.slug}">
        <h3 style="margin:0">${esc(t.name)} quote template</h3><p class="muted" style="margin:6px 0 0">For ${esc(t.who)}</p></a>`).join("")}</div>
    </article>`;
  return page({
    title: "Free Quote Templates for Contractors and Trades | QuoteSmith",
    description: "Free quote templates with worked examples for plumbers, electricians, painters, handymen, HVAC, roofers, landscapers and cleaners.",
    path: "/quote-template",
    base,
    body,
  });
}

export function sitemap(base) {
  const paths = ["/", "/quote-template", ...TRADES.map((t) => `/quote-template/${t.slug}`)];
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${paths.map((p) => `  <url><loc>${esc(base + p)}</loc></url>`).join("\n")}
</urlset>
`;
}

export function robots(base) {
  return `User-agent: *
Disallow: /api/
Disallow: /q/
Disallow: /dashboard
Disallow: /login
Sitemap: ${base}/sitemap.xml
`;
}
