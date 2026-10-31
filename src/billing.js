import Stripe from "stripe";
import * as store from "./store.js";

// Billing turns on when STRIPE_SECRET_KEY and at least one price ID are set.
const PRICES = { pro: process.env.STRIPE_PRICE_PRO, crew: process.env.STRIPE_PRICE_CREW };
const PLAN_BY_PRICE = Object.fromEntries(Object.entries(PRICES).filter(([, id]) => id).map(([plan, id]) => [id, plan]));
const TRIAL_DAYS = Number(process.env.STRIPE_TRIAL_DAYS || 0);
const ACTIVE = new Set(["active", "trialing", "past_due"]);

let stripe = null;
if (process.env.STRIPE_SECRET_KEY) {
  // STRIPE_API_BASE lets tests point the SDK at a local fake.
  const base = process.env.STRIPE_API_BASE ? new URL(process.env.STRIPE_API_BASE) : null;
  stripe = new Stripe(process.env.STRIPE_SECRET_KEY, base
    ? { host: base.hostname, port: Number(base.port), protocol: base.protocol.replace(":", "") }
    : {});
}

export function billingStatus() {
  return { enabled: Boolean(stripe), plans: Object.keys(PRICES).filter((p) => PRICES[p]), trialDays: TRIAL_DAYS };
}

export function canCheckout(plan) {
  return Boolean(stripe && PRICES[plan]);
}

async function customerFor(user) {
  if (user.stripeCustomerId) return user.stripeCustomerId;
  const customer = await stripe.customers.create({ email: user.email, metadata: { userId: user.id } });
  store.setStripeCustomer(user.id, customer.id);
  return customer.id;
}

export async function createCheckout(user, plan, origin) {
  const metadata = { userId: user.id, plan };
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: await customerFor(user),
    client_reference_id: user.id,
    line_items: [{ price: PRICES[plan], quantity: 1 }],
    allow_promotion_codes: true,
    metadata,
    subscription_data: { metadata, ...(TRIAL_DAYS > 0 ? { trial_period_days: TRIAL_DAYS } : {}) },
    success_url: `${origin}/dashboard?upgraded=${plan}`,
    cancel_url: `${origin}/dashboard#plan`,
  });
  return session.url;
}

export async function createPortal(user, origin) {
  const session = await stripe.billingPortal.sessions.create({
    customer: user.stripeCustomerId,
    return_url: `${origin}/dashboard#plan`,
  });
  return session.url;
}

function planFromSubscription(sub) {
  const priceId = sub.items?.data?.[0]?.price?.id;
  return PLAN_BY_PRICE[priceId] || sub.metadata?.plan || "pro";
}

function findUser(customerId, metadata) {
  return (customerId && store.userByStripeCustomer(customerId)) || (metadata?.userId && store.getUser(metadata.userId)) || null;
}

// Throws if the signature is invalid; the caller turns that into a 400.
export function handleWebhook(rawBody, signature) {
  const event = stripe.webhooks.constructEvent(rawBody, signature, process.env.STRIPE_WEBHOOK_SECRET);
  const obj = event.data.object;

  if (event.type === "checkout.session.completed" && obj.mode === "subscription") {
    const user = findUser(obj.customer, obj.metadata) || (obj.client_reference_id && store.getUser(obj.client_reference_id));
    if (user) {
      store.setSubscription(user.id, {
        plan: obj.metadata?.plan || "pro", status: "active", customerId: obj.customer, subscriptionId: obj.subscription,
      });
    }
  }

  if (event.type === "customer.subscription.created" || event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted") {
    const user = findUser(obj.customer, obj.metadata);
    if (user) {
      const active = event.type !== "customer.subscription.deleted" && ACTIVE.has(obj.status);
      store.setSubscription(user.id, {
        plan: active ? planFromSubscription(obj) : "free", status: obj.status, customerId: obj.customer, subscriptionId: obj.id,
      });
    }
  }
  return event.type;
}
