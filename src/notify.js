import fs from "node:fs";
import path from "node:path";

// Email alerts to contractors. Sends through Resend when RESEND_API_KEY is set; otherwise writes to a
// local outbox file so the flow can be developed and tested without an email account.
const FROM = process.env.EMAIL_FROM || "QuoteSmith <alerts@quotesmith.app>";
const OUTBOX = path.join(process.env.DATA_DIR || path.resolve("data"), "outbox.log");

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

async function send({ to, subject, text, html }) {
  if (!process.env.RESEND_API_KEY) {
    fs.appendFileSync(OUTBOX, JSON.stringify({ at: new Date().toISOString(), to, subject, text }) + "\n");
    return;
  }
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${process.env.RESEND_API_KEY}`, "content-type": "application/json" },
    body: JSON.stringify({ from: FROM, to, subject, text, html }),
  });
  if (!r.ok) throw new Error(`email send failed: ${r.status} ${await r.text()}`);
}

// Never let a failed email break the customer's request.
function fireAndForget(msg) {
  send(msg).catch((err) => console.error(err.message));
}

function quoteLabel(q) {
  return `${q.number ? `#${q.number} ` : ""}${q.quote.title}`;
}

export function quoteViewed(owner, q, appUrl) {
  const who = q.input.customerName || "Your customer";
  fireAndForget({
    to: owner.profile.email || owner.email,
    subject: `${who} just opened your quote`,
    text: `${who} opened "${quoteLabel(q)}". Now's a good time to follow up.\n\n${appUrl}/q/${q.id}`,
    html: `<p><strong>${esc(who)}</strong> opened <a href="${esc(appUrl)}/q/${esc(q.id)}">${esc(quoteLabel(q))}</a>.</p><p>Now's a good time to follow up.</p>`,
  });
}

export function quoteResponded(owner, q, appUrl) {
  const accepted = q.status === "accepted";
  const who = q.signature || q.input.customerName || "Your customer";
  const note = q.customerNote ? `\n\nTheir note: "${q.customerNote}"` : "";
  fireAndForget({
    to: owner.profile.email || owner.email,
    subject: accepted ? `Quote accepted: ${quoteLabel(q)}` : `Quote declined: ${quoteLabel(q)}`,
    text: `${who} ${accepted ? "accepted" : "declined"} "${quoteLabel(q)}".${note}\n\n${appUrl}/q/${q.id}`,
    html: `<p><strong>${esc(who)}</strong> ${accepted ? "accepted" : "declined"} <a href="${esc(appUrl)}/q/${esc(q.id)}">${esc(quoteLabel(q))}</a>.</p>${q.customerNote ? `<blockquote>${esc(q.customerNote)}</blockquote>` : ""}`,
  });
}
