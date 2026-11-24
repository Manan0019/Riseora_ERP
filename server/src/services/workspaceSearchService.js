import db from "../db/database.js";

export function searchWorkspace(query) {
  const q = String(query ?? "").trim().slice(0, 100);
  if (q.length < 2) return [];
  // instr uses literal substrings rather than wildcard patterns.
  const sources = [
    ["Item", "/items", "SELECT id, name AS label FROM items WHERE instr(lower(name || ' ' || code), lower(?)) > 0 ORDER BY name LIMIT 8", true],
    ["Supplier", "/suppliers", "SELECT id, name AS label FROM suppliers WHERE instr(lower(name || ' ' || code), lower(?)) > 0 ORDER BY name LIMIT 8", true],
    ["Customer", "/customers", "SELECT id, name AS label FROM customers WHERE instr(lower(name || ' ' || code), lower(?)) > 0 ORDER BY name LIMIT 8", true],
    ["Purchase", "/purchase-register", "SELECT id, purchase_no AS label FROM purchases WHERE instr(lower(purchase_no), lower(?)) > 0 ORDER BY id DESC LIMIT 8", false],
    ["Invoice", "/sales-register", "SELECT id, invoice_no AS label FROM sales_invoices WHERE instr(lower(invoice_no), lower(?)) > 0 ORDER BY id DESC LIMIT 8", false],
    ["Formula", "/formulas", "SELECT id, code || ' — ' || name AS label, code AS search FROM formulas WHERE instr(lower(name || ' ' || code), lower(?)) > 0 ORDER BY id DESC LIMIT 8", false],
  ];
  return sources.flatMap(([kind, path, sql, direct]) => db.prepare(sql).all(q).map(row => ({kind,label:row.label,path:`${path}?${direct ? `record=${row.id}` : `find=${encodeURIComponent(row.search || row.label)}`}`})));
}
