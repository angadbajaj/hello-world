import PDFDocument from "pdfkit";

// Mirrors public/quote-render.js so the PDF and the web page always agree.
function unitPrice(li, markup = 0) {
  const price = Number(li.unit_price) || 0;
  return li.category === "materials" ? price * (1 + markup / 100) : price;
}

function lineTotal(li, markup = 0) {
  return (Number(li.quantity) || 0) * unitPrice(li, markup);
}

function money(n, currency) {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(n || 0);
  } catch {
    return `${currency} ${(n || 0).toFixed(2)}`;
  }
}

function logoBuffer(dataUrl) {
  const m = /^data:image\/(png|jpeg);base64,(.+)$/.exec(dataUrl || "");
  return m ? Buffer.from(m[2], "base64") : null;
}

// Streams the quote as a PDF into `out` (an HTTP response).
export function renderQuotePdf(q, { logo, branded }, out) {
  const { quote, input } = q;
  const cur = input.currency || "USD";
  const doc = new PDFDocument({ size: "LETTER", margin: 50, info: { Title: quote.title } });
  doc.pipe(out);
  const left = doc.page.margins.left;
  const width = doc.page.width - left - doc.page.margins.right;
  const muted = "#6b6a64";

  // Header: logo/business on the left, quote meta on the right.
  const top = doc.y;
  const img = logoBuffer(logo);
  if (img) {
    try { doc.image(img, left, top, { fit: [140, 60] }); } catch { /* bad image, skip */ }
  }
  const bizY = img ? top + 66 : top;
  doc.font("Helvetica-Bold").fontSize(14).fillColor("#1d1d1b").text(input.businessName || input.trade || "", left, bizY, { width: width / 2 });
  doc.font("Helvetica").fontSize(9).fillColor(muted)
    .text([input.location, input.contactPhone, input.contactEmail].filter(Boolean).join("  ·  "), { width: width / 2 });
  doc.font("Helvetica-Bold").fontSize(20).fillColor("#1d1d1b").text("QUOTE", left + width / 2, top, { width: width / 2, align: "right" });
  doc.font("Helvetica").fontSize(10).fillColor(muted).text(
    [q.number ? `#${q.number}` : null, new Date(q.updatedAt || q.createdAt).toLocaleDateString("en-US"),
      input.customerName ? `For: ${input.customerName}` : null].filter(Boolean).join("\n"),
    left + width / 2, doc.y, { width: width / 2, align: "right" });

  doc.y = Math.max(doc.y, bizY + 40) + 20;
  doc.font("Helvetica-Bold").fontSize(16).fillColor("#1d1d1b").text(quote.title, left, doc.y, { width });
  doc.moveDown(0.3).font("Helvetica").fontSize(10).text(quote.summary, { width });
  doc.moveDown(1);

  // Line items table.
  const cols = [
    { label: "Item", w: width * 0.5, align: "left" },
    { label: "Qty", w: width * 0.14, align: "right" },
    { label: "Price", w: width * 0.18, align: "right" },
    { label: "Total", w: width * 0.18, align: "right" },
  ];
  const row = (cells, { bold = false } = {}) => {
    if (doc.y > doc.page.height - 120) doc.addPage();
    const y = doc.y;
    let x = left;
    let h = 0;
    doc.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(10).fillColor("#1d1d1b");
    cells.forEach((c, i) => {
      doc.text(c, x + 2, y, { width: cols[i].w - 4, align: cols[i].align });
      h = Math.max(h, doc.y - y);
      x += cols[i].w;
    });
    doc.y = y + h + 5;
    doc.moveTo(left, doc.y - 2).lineTo(left + width, doc.y - 2).strokeColor("#e4e2da").lineWidth(0.5).stroke();
  };
  row(cols.map((c) => c.label), { bold: true });
  let subtotal = 0;
  for (const li of quote.line_items) {
    const t = lineTotal(li, input.markup);
    subtotal += t;
    row([li.description, `${li.quantity} ${li.unit}`, money(unitPrice(li, input.markup), cur), money(t, cur)]);
  }
  const tax = subtotal * ((input.taxRate || 0) / 100);

  // Totals block.
  doc.moveDown(0.5);
  const tx = left + width * 0.55;
  const tw = width * 0.45;
  const totalLine = (label, value, bold) => {
    const y = doc.y;
    doc.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(bold ? 13 : 10);
    doc.text(label, tx, y, { width: tw / 2 });
    doc.text(value, tx + tw / 2, y, { width: tw / 2, align: "right" });
    doc.moveDown(0.3);
  };
  totalLine("Subtotal", money(subtotal, cur));
  if (tax) totalLine(`Tax (${input.taxRate}%)`, money(tax, cur));
  totalLine("Total", money(subtotal + tax, cur), true);
  if (input.depositPercent) totalLine(`Deposit due (${input.depositPercent}%)`, money(((subtotal + tax) * input.depositPercent) / 100, cur));
  doc.x = left;
  doc.moveDown(1);

  const section = (title, items) => {
    if (!items?.length) return;
    if (doc.y > doc.page.height - 120) doc.addPage();
    doc.font("Helvetica-Bold").fontSize(11).fillColor("#1d1d1b").text(title, left, doc.y, { width });
    doc.font("Helvetica").fontSize(10).list(items, { width, bulletRadius: 1.5, textIndent: 10 });
    doc.moveDown(0.6);
  };
  if (quote.estimated_duration) {
    doc.font("Helvetica-Bold").fontSize(10).text("Estimated duration: ", left, doc.y, { continued: true }).font("Helvetica").text(quote.estimated_duration);
    doc.moveDown(0.6);
  }
  section("Scope of work", quote.scope_of_work);
  section("Not included", quote.exclusions);
  section("Assumptions", quote.assumptions);
  section("Terms", quote.terms);

  if (q.respondedAt) {
    doc.moveDown(0.5).font("Helvetica-Bold").fontSize(10).fillColor(q.status === "accepted" ? "#2b8a3e" : "#c92a2a")
      .text(`${q.status === "accepted" ? "Accepted" : "Declined"} by ${q.signature || "customer"} on ${new Date(q.respondedAt).toLocaleString("en-US")}`, left);
  }
  if (branded) {
    // Writing inside the bottom margin would otherwise start a new page.
    doc.page.margins.bottom = 0;
    doc.font("Helvetica").fontSize(8).fillColor(muted).text("Made with QuoteSmith", left, doc.page.height - 30, { width, align: "center", lineBreak: false });
  }
  doc.end();
}
