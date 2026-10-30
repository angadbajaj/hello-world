import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

// Minimal JSON-file store. Good enough for the MVP; swap for SQLite/Postgres before real traffic.
const DATA_DIR = process.env.DATA_DIR || path.resolve("data");
const FILE = path.join(DATA_DIR, "quotes.json");

function load() {
  try {
    return JSON.parse(fs.readFileSync(FILE, "utf8"));
  } catch {
    return {};
  }
}

function save(db) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmp = FILE + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
  fs.renameSync(tmp, FILE);
}

export function createQuote(record) {
  const db = load();
  const id = crypto.randomBytes(6).toString("base64url");
  const editKey = crypto.randomBytes(12).toString("base64url");
  db[id] = { ...record, id, editKey, status: "draft", createdAt: new Date().toISOString() };
  save(db);
  return db[id];
}

export function getQuote(id) {
  return load()[id] || null;
}

export function updateQuote(id, patch) {
  const db = load();
  if (!db[id]) return null;
  db[id] = { ...db[id], ...patch, updatedAt: new Date().toISOString() };
  save(db);
  return db[id];
}

// What the customer is allowed to see.
export function publicView(q) {
  const { editKey, ...rest } = q;
  return rest;
}
