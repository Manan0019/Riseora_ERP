import db from "../db/database.js";
import { toTitleCase } from "../utils/textFormat.js";

function normalize(data) {
  const upadDate = String(data.upadDate || data.upad_date || "").trim();
  const personName = toTitleCase(data.personName || data.person_name) || null;
  const amount = Number(data.amount || 0);
  const notes = String(data.notes || "").trim() || null;

  if (!upadDate) throw new Error("Upad date is required.");
  if (!Number.isFinite(amount) || amount <= 0) throw new Error("Upad amount must be greater than zero.");
  return { upadDate, personName, amount, notes };
}

export function getUpadEntries(includeInactive = false) {
  const where = includeInactive ? "" : "WHERE is_active = 1";
  return db.prepare(`
    SELECT * FROM upad_entries
    ${where}
    ORDER BY upad_date DESC, id DESC
  `).all();
}

export function getUpadById(id) {
  return db.prepare(`SELECT * FROM upad_entries WHERE id = ?`).get(Number(id));
}

export function createUpad(data) {
  const value = normalize(data);
  const result = db.prepare(`
    INSERT INTO upad_entries (upad_date, person_name, amount, notes)
    VALUES (?, ?, ?, ?)
  `).run(value.upadDate, value.personName, value.amount, value.notes);
  return getUpadById(result.lastInsertRowid);
}

export function updateUpad(id, data) {
  const upadId = Number(id);
  if (!getUpadById(upadId)) throw new Error("Upad entry not found.");
  const value = normalize(data);
  db.prepare(`
    UPDATE upad_entries
    SET upad_date = ?, person_name = ?, amount = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(value.upadDate, value.personName, value.amount, value.notes, upadId);
  return getUpadById(upadId);
}

export function deactivateUpad(id) {
  const upadId = Number(id);
  if (!getUpadById(upadId)) throw new Error("Upad entry not found.");
  db.prepare(`UPDATE upad_entries SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(upadId);
  return getUpadById(upadId);
}

export function activateUpad(id) {
  const upadId = Number(id);
  if (!getUpadById(upadId)) throw new Error("Upad entry not found.");
  db.prepare(`UPDATE upad_entries SET is_active = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(upadId);
  return getUpadById(upadId);
}

export function getUpadSummary() {
  const grossSales = Number(db.prepare(`
    SELECT COALESCE(SUM(grand_total), 0) AS total
    FROM sales_invoices WHERE status = 'POSTED'
  `).get()?.total || 0);

  const salesCredits = Number(db.prepare(`
    SELECT COALESCE(SUM(scn.grand_total), 0) AS total
    FROM sales_credit_notes scn
    INNER JOIN sales_invoices si ON si.id = scn.sales_invoice_id
    WHERE scn.status = 'POSTED' AND si.status = 'POSTED'
  `).get()?.total || 0);

  const totalUpad = Number(db.prepare(`
    SELECT COALESCE(SUM(amount), 0) AS total
    FROM upad_entries WHERE is_active = 1
  `).get()?.total || 0);

  const totalSales = grossSales - salesCredits;
  return {
    totalSales,
    totalUpad,
    netSalesAfterUpad: totalSales - totalUpad,
  };
}
