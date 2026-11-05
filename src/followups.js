import * as store from "./store.js";
import * as notify from "./notify.js";

// Pro follow-ups. Each quote gets at most one "not opened" nudge and one "opened, no answer" nudge to the
// contractor, and (if the contractor opted in and gave an email) at most one reminder to the customer.
const DAY = 864e5;
export const UNOPENED_AFTER = 2 * DAY;
export const UNANSWERED_AFTER = 3 * DAY;
const GIVE_UP_AFTER = 30 * DAY;

export async function runFollowUps({ now = Date.now(), appUrl }) {
  const done = { nudges: 0, reminders: 0 };
  for (const q of store.followUpCandidates()) {
    const sent = Date.parse(q.sentAt || q.createdAt);
    if (now - sent > GIVE_UP_AFTER) continue;
    const owner = store.getUser(q.userId);
    if (!owner) continue;

    let kind = null;
    if (!q.viewedAt && !q.nudgedUnopenedAt && now - sent >= UNOPENED_AFTER) kind = "unopened";
    else if (q.viewedAt && !q.nudgedUnansweredAt && now - Date.parse(q.viewedAt) >= UNANSWERED_AFTER) kind = "unanswered";
    if (!kind) continue;

    const at = new Date(now).toISOString();
    store.updateQuote(q.id, kind === "unopened" ? { nudgedUnopenedAt: at } : { nudgedUnansweredAt: at });
    notify.nudgeContractor(owner, q, kind, appUrl);
    done.nudges++;

    if (owner.profile.remindCustomers && q.input.customerEmail && !q.remindedCustomerAt) {
      store.updateQuote(q.id, { remindedCustomerAt: at });
      try {
        await notify.quoteToCustomer(owner, q, appUrl, { reminder: true });
        done.reminders++;
      } catch (err) {
        console.error("customer reminder:", err.message);
      }
    }
  }
  return done;
}

// Flags a quote for the dashboard so every plan can see what needs chasing, even without automatic emails.
export function needsFollowUp(q, now = Date.now()) {
  if (q.status !== "sent") return null;
  const sent = Date.parse(q.sentAt || q.createdAt);
  if (now - sent > GIVE_UP_AFTER) return null;
  if (!q.viewedAt) return now - sent >= UNOPENED_AFTER ? "not opened yet" : null;
  return now - Date.parse(q.viewedAt) >= UNANSWERED_AFTER ? "opened, no answer" : null;
}
