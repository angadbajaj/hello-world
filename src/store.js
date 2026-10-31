import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { DatabaseSync } from "node:sqlite";

const DATA_DIR = process.env.DATA_DIR || path.resolve("data");
fs.mkdirSync(DATA_DIR, { recursive: true });
const db = new DatabaseSync(path.join(DATA_DIR, "quotesmith.db"));

db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    pass_hash TEXT NOT NULL,
    plan TEXT NOT NULL DEFAULT 'free',
    profile TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS quotes (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
    edit_key TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft',
    input TEXT NOT NULL,
    quote TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT,
    claimed_at TEXT,
    viewed_at TEXT,
    responded_at TEXT,
    signature TEXT,
    customer_note TEXT
  );
  CREATE INDEX IF NOT EXISTS quotes_user ON quotes(user_id, created_at);
`);

// Additive migrations for databases created by earlier versions.
const userCols = new Set(db.prepare("PRAGMA table_info(users)").all().map((c) => c.name));
for (const [col, type] of [["stripe_customer_id", "TEXT"], ["stripe_subscription_id", "TEXT"], ["plan_status", "TEXT"]]) {
  if (!userCols.has(col)) db.exec(`ALTER TABLE users ADD COLUMN ${col} ${type}`);
}

const now = () => new Date().toISOString();
const newId = (bytes) => crypto.randomBytes(bytes).toString("base64url");

// ---- users & sessions ----

function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, 32);
  return `${salt.toString("hex")}:${hash.toString("hex")}`;
}

function checkPassword(password, stored) {
  const [salt, hash] = stored.split(":");
  const test = crypto.scryptSync(password, Buffer.from(salt, "hex"), 32);
  return crypto.timingSafeEqual(test, Buffer.from(hash, "hex"));
}

function toUser(row) {
  if (!row) return null;
  return {
    id: row.id, email: row.email, plan: row.plan, planStatus: row.plan_status, profile: JSON.parse(row.profile),
    stripeCustomerId: row.stripe_customer_id, createdAt: row.created_at,
  };
}

export function createUser(email, password) {
  const id = newId(9);
  try {
    db.prepare("INSERT INTO users (id, email, pass_hash, created_at) VALUES (?, ?, ?, ?)").run(
      id, email.toLowerCase(), hashPassword(password), now());
  } catch (err) {
    if (String(err.message).includes("UNIQUE")) return null;
    throw err;
  }
  return getUser(id);
}

export function verifyUser(email, password) {
  const row = db.prepare("SELECT * FROM users WHERE email = ?").get(email.toLowerCase());
  if (!row || !checkPassword(password, row.pass_hash)) return null;
  return toUser(row);
}

export function getUser(id) {
  return toUser(db.prepare("SELECT * FROM users WHERE id = ?").get(id));
}

export function updateProfile(id, profile) {
  db.prepare("UPDATE users SET profile = ? WHERE id = ?").run(JSON.stringify(profile), id);
  return getUser(id);
}

export function setStripeCustomer(id, customerId) {
  db.prepare("UPDATE users SET stripe_customer_id = ? WHERE id = ?").run(customerId, id);
}

export function userByStripeCustomer(customerId) {
  return toUser(db.prepare("SELECT * FROM users WHERE stripe_customer_id = ?").get(customerId));
}

export function setSubscription(id, { plan, status, customerId, subscriptionId }) {
  db.prepare(`UPDATE users SET plan = ?, plan_status = ?, stripe_customer_id = COALESCE(?, stripe_customer_id),
    stripe_subscription_id = COALESCE(?, stripe_subscription_id) WHERE id = ?`).run(plan, status, customerId ?? null, subscriptionId ?? null, id);
}

const SESSION_DAYS = 30;
export function createSession(userId) {
  const token = newId(24);
  const expires = new Date(Date.now() + SESSION_DAYS * 864e5).toISOString();
  db.prepare("INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)").run(token, userId, expires);
  return { token, maxAge: SESSION_DAYS * 86400 };
}

export function userForSession(token) {
  if (!token) return null;
  const row = db.prepare("SELECT user_id, expires_at FROM sessions WHERE token = ?").get(token);
  if (!row || row.expires_at < now()) return null;
  return getUser(row.user_id);
}

export function deleteSession(token) {
  db.prepare("DELETE FROM sessions WHERE token = ?").run(token);
}

// ---- quotes ----

function toQuote(row) {
  if (!row) return null;
  return {
    id: row.id, userId: row.user_id, editKey: row.edit_key, status: row.status,
    input: JSON.parse(row.input), quote: JSON.parse(row.quote),
    createdAt: row.created_at, updatedAt: row.updated_at, viewedAt: row.viewed_at,
    respondedAt: row.responded_at, signature: row.signature, customerNote: row.customer_note,
  };
}

export function createQuote({ input, quote, userId = null }) {
  const id = newId(6);
  const t = now();
  db.prepare(`INSERT INTO quotes (id, user_id, edit_key, input, quote, created_at, claimed_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)`).run(id, userId, newId(12), JSON.stringify(input), JSON.stringify(quote), t, userId ? t : null);
  return getQuote(id);
}

export function getQuote(id) {
  return toQuote(db.prepare("SELECT * FROM quotes WHERE id = ?").get(id));
}

const COLUMNS = { status: "status", input: "input", quote: "quote", userId: "user_id", viewedAt: "viewed_at",
  respondedAt: "responded_at", signature: "signature", customerNote: "customer_note", claimedAt: "claimed_at" };

export function updateQuote(id, patch) {
  const sets = [];
  const vals = [];
  for (const [k, v] of Object.entries(patch)) {
    if (!COLUMNS[k]) continue;
    sets.push(`${COLUMNS[k]} = ?`);
    vals.push(typeof v === "object" && v !== null ? JSON.stringify(v) : v);
  }
  sets.push("updated_at = ?");
  vals.push(now(), id);
  db.prepare(`UPDATE quotes SET ${sets.join(", ")} WHERE id = ?`).run(...vals);
  return getQuote(id);
}

export function listQuotes(userId) {
  return db.prepare("SELECT * FROM quotes WHERE user_id = ? ORDER BY created_at DESC").all(userId).map(toQuote);
}

// Quotes that count against the monthly allowance: ones the user generated or claimed this calendar month (UTC).
export function quotesThisMonth(userId) {
  const start = new Date();
  start.setUTCDate(1);
  start.setUTCHours(0, 0, 0, 0);
  return db.prepare("SELECT COUNT(*) AS n FROM quotes WHERE user_id = ? AND claimed_at >= ?").get(userId, start.toISOString()).n;
}

// What the customer is allowed to see.
export function publicView(q) {
  const { editKey, userId, ...rest } = q;
  return rest;
}
