import fs from "node:fs";
import path from "node:path";

// Email alerts to contractors. Sends through Resend when RESEND_API_KEY is set; otherwise writes to a
// local outbox file so the flow can be developed and tested without an email account.
const FROM = process.env.EMAIL_FROM || "QuoteSmith <alerts@quotesmith.app>";
const OUTBOX = path.join(process.env.DATA_DIR || path.resolve("data"), "outbox.log");

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

async function send({ to, subject, text, html, from = FROM, replyTo }) {
  if (!process.env.RESEND_API_KEY) {
    fs.appendFileSync(OUTBOX, JSON.stringify({ at: new Date().toISOString(), to, from, replyTo, subject, text }) + "\n");
    return;
  }
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${process.env.RESEND_API_KEY}`, "content-type": "application/json" },
    body: JSON.stringify({ from, to, subject, text, html, ...(replyTo ? { reply_to: replyTo } : {}) }),
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

export function passwordReset(to, link) {
  fireAndForget({
    to,
    subject: "Reset your QuoteSmith password",
    text: `Someone asked to reset the password for this QuoteSmith account. If it was you, open this link within an hour:\n\n${link}\n\nIf it wasn't you, ignore this email and nothing will change.`,
    html: `<p>Someone asked to reset the password for this QuoteSmith account. If it was you, <a href="${esc(link)}">choose a new password</a> within an hour.</p><p>If it wasn't you, ignore this email and nothing will change.</p>`,
  });
}

// ---- emails to the contractor's customer (sent only when the contractor asks, or opted in to one reminder) ----

// "Smith Plumbing via QuoteSmith <alerts@...>" so the customer recognises who it's from; replies go to the contractor.
function fromContractor(owner) {
  const address = /<([^>]+)>/.exec(FROM)?.[1] || FROM;
  const name = (owner.profile.businessName || "Your contractor").replace(/["<>]/g, "");
  return `"${name} via QuoteSmith" <${address}>`;
}

export function quoteToCustomer(owner, q, appUrl, { reminder = false } = {}) {
  const biz = owner.profile.businessName || "Your contractor";
  const hi = q.input.customerName ? `Hi ${q.input.customerName.split(" ")[0]},` : "Hi,";
  const link = `${appUrl}/q/${q.id}`;
  const lead = reminder
    ? `Just checking you received the quote for "${q.quote.title}". You can review and accept it here:`
    : `Here's your quote for "${q.quote.title}". You can review it and accept it online:`;
  return send({
    to: q.input.customerEmail,
    from: fromContractor(owner),
    replyTo: owner.profile.email || owner.email,
    subject: reminder ? `Reminder: your quote from ${biz}` : `Your quote from ${biz}${q.number ? ` (#${q.number})` : ""}`,
    text: `${hi}\n\n${lead}\n\n${link}\n\nAny questions, just reply to this email.\n\n${biz}`,
    html: `<p>${esc(hi)}</p><p>${esc(lead)}</p><p><a href="${esc(link)}" style="display:inline-block;background:#d9480f;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none;font-weight:600">View your quote</a></p><p>Any questions, just reply to this email.</p><p>${esc(biz)}</p>`,
  });
}

export function nudgeContractor(owner, q, kind, appUrl) {
  const who = q.input.customerName || "Your customer";
  const subject = kind === "unopened"
    ? `${who} hasn't opened your quote yet`
    : `${who} opened your quote but hasn't answered`;
  const tip = kind === "unopened"
    ? "It may be sitting in spam, or they missed it. A quick call or text usually gets it seen."
    : "They've looked at it, so they're deciding. This is the best moment to call and answer any questions.";
  fireAndForget({
    to: owner.profile.email || owner.email,
    subject,
    text: `${subject}: "${quoteLabel(q)}".\n\n${tip}\n\n${appUrl}/q/${q.id}`,
    html: `<p><strong>${esc(subject)}</strong>: <a href="${esc(appUrl)}/q/${esc(q.id)}">${esc(quoteLabel(q))}</a>.</p><p>${esc(tip)}</p>`,
  });
}
