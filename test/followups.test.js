import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// The store opens its database on import, so point it at a throwaway directory first.
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "qs-followups-"));
process.env.DATA_DIR = dataDir;
delete process.env.RESEND_API_KEY;
const store = await import("../src/store.js");
const { runFollowUps, needsFollowUp } = await import("../src/followups.js");
test.after(() => fs.rmSync(dataDir, { recursive: true, force: true }));

const DAY = 864e5;
const NOW = Date.parse("2026-11-10T12:00:00Z");
const ago = (days) => new Date(NOW - days * DAY).toISOString();
const outbox = () => {
  const f = path.join(dataDir, "outbox.log");
  return fs.existsSync(f) ? fs.readFileSync(f, "utf8").trim().split("\n").map((l) => JSON.parse(l)) : [];
};
const settle = () => new Promise((r) => setTimeout(r, 50));
const QUOTE = { title: "Tap replacement", summary: "", line_items: [], scope_of_work: [], exclusions: [], assumptions: [],
  estimated_duration: "", terms: [], questions_for_client: [] };

function account(email, plan, profile = {}) {
  const u = store.createUser(email, "password1");
  store.updateProfile(u.id, { businessName: "Smith Plumbing", email: `office+${email}`, ...profile });
  if (plan !== "free") store.setSubscription(u.id, { plan, status: "active" });
  return u;
}
function sentQuote(user, { sentDaysAgo, viewedDaysAgo, customerEmail = "jane@example.com" }) {
  const q = store.createQuote({ input: { customerName: "Jane Doe", customerEmail }, quote: QUOTE, userId: user.id });
  return store.updateQuote(q.id, { status: "sent", sentAt: ago(sentDaysAgo), viewedAt: viewedDaysAgo == null ? null : ago(viewedDaysAgo) });
}

test("unopened quote: one contractor nudge and, if opted in, one customer reminder", async () => {
  const pro = account("pro1@example.com", "pro", { remindCustomers: true });
  const q = sentQuote(pro, { sentDaysAgo: 2.5 });
  const fresh = sentQuote(pro, { sentDaysAgo: 1 });

  assert.deepEqual(await runFollowUps({ now: NOW, appUrl: "https://qs.test" }), { nudges: 1, reminders: 1 });
  await settle();
  const mail = outbox();
  const nudge = mail.find((m) => m.to === "office+pro1@example.com");
  assert.equal(nudge.subject, "Jane Doe hasn't opened your quote yet");
  const reminder = mail.find((m) => m.to === "jane@example.com");
  assert.equal(reminder.subject, "Reminder: your quote from Smith Plumbing");
  assert.equal(reminder.replyTo, "office+pro1@example.com");
  assert.match(reminder.from, /^"Smith Plumbing via QuoteSmith"/);
  assert.ok(reminder.text.includes(`https://qs.test/q/${q.id}`));

  // Nothing repeats on the next run, and the 1-day-old quote isn't due yet.
  assert.deepEqual(await runFollowUps({ now: NOW, appUrl: "https://qs.test" }), { nudges: 0, reminders: 0 });
  assert.equal(needsFollowUp(store.getQuote(fresh.id), NOW), null);

  // Once opened and left unanswered for 3 days: a second contractor nudge, but never a second customer email.
  store.updateQuote(q.id, { viewedAt: ago(3) });
  assert.deepEqual(await runFollowUps({ now: NOW, appUrl: "https://qs.test" }), { nudges: 1, reminders: 0 });
  await settle();
  assert.equal(outbox().filter((m) => m.to === "jane@example.com").length, 1);
  assert.ok(outbox().some((m) => m.subject === "Jane Doe opened your quote but hasn't answered"));
});

test("free plans, opted-out contractors, missing emails and stale quotes get no emails", async () => {
  const free = account("free1@example.com", "free", { remindCustomers: true });
  const fq = sentQuote(free, { sentDaysAgo: 5 });
  const quiet = account("pro2@example.com", "pro", { remindCustomers: false });
  sentQuote(quiet, { sentDaysAgo: 5 });
  const noEmail = account("pro3@example.com", "pro", { remindCustomers: true });
  sentQuote(noEmail, { sentDaysAgo: 5, customerEmail: "" });
  const old = account("pro4@example.com", "pro", { remindCustomers: true });
  sentQuote(old, { sentDaysAgo: 45 });

  const before = outbox().length;
  assert.deepEqual(await runFollowUps({ now: NOW, appUrl: "https://qs.test" }), { nudges: 2, reminders: 0 });
  await settle();
  const sent = outbox().slice(before).map((m) => m.to).sort();
  assert.deepEqual(sent, ["office+pro2@example.com", "office+pro3@example.com"]);

  // Free users still see what needs chasing on their dashboard.
  assert.equal(needsFollowUp(store.getQuote(fq.id), NOW), "not opened yet");
});

test("needsFollowUp labels", () => {
  const base = { status: "sent", createdAt: ago(10) };
  assert.equal(needsFollowUp({ ...base, sentAt: ago(1) }, NOW), null);
  assert.equal(needsFollowUp({ ...base, sentAt: ago(2) }, NOW), "not opened yet");
  assert.equal(needsFollowUp({ ...base, sentAt: ago(5), viewedAt: ago(2) }, NOW), null);
  assert.equal(needsFollowUp({ ...base, sentAt: ago(5), viewedAt: ago(3) }, NOW), "opened, no answer");
  assert.equal(needsFollowUp({ ...base, status: "accepted", sentAt: ago(5) }, NOW), null);
  assert.equal(needsFollowUp({ ...base, sentAt: ago(31) }, NOW), null);
});
