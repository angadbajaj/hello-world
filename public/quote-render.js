// Shared helpers for rendering a quote (used by the editor and the customer page).
export const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

export function money(n, currency = "USD") {
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(n || 0);
  } catch {
    return `${currency} ${(n || 0).toFixed(2)}`;
  }
}

export function totals(quote, { markup = 0, taxRate = 0 } = {}) {
  let subtotal = 0;
  for (const li of quote.line_items) {
    const base = (Number(li.quantity) || 0) * (Number(li.unit_price) || 0);
    subtotal += li.category === "materials" ? base * (1 + markup / 100) : base;
  }
  const tax = subtotal * (taxRate / 100);
  return { subtotal, tax, total: subtotal + tax };
}

export function lineTotal(li, markup = 0) {
  const base = (Number(li.quantity) || 0) * (Number(li.unit_price) || 0);
  return li.category === "materials" ? base * (1 + markup / 100) : base;
}

export function listHtml(title, items) {
  if (!items?.length) return "";
  return `<h3>${esc(title)}</h3><ul>${items.map((i) => `<li>${esc(i)}</li>`).join("")}</ul>`;
}
