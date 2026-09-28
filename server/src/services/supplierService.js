import db from "../db/database.js";
import { toTitleCase } from "../utils/textFormat.js";

function normalizePaymentTerms(data) {
  const days = Number(data.paymentTermsDays || 0);
  if (!Number.isInteger(days) || days < 0) {
    throw new Error("Payment terms must be a non-negative whole number of days.");
  }
  return days;
}

function generateSupplierCode() {
  let nextId = Number(
    db.prepare(`SELECT COALESCE(MAX(id), 0) + 1 AS next_id FROM suppliers`).get()?.next_id || 1,
  );

  while (true) {
    const code = `SUP-${String(nextId).padStart(5, "0")}`;
    const exists = db.prepare(`SELECT 1 FROM suppliers WHERE code = ?`).get(code);
    if (!exists) return code;
    nextId += 1;
  }
}

export function getSuppliers(includeInactive = false) {
  const sql = includeInactive
    ? `SELECT * FROM suppliers ORDER BY is_active DESC, name`
    : `SELECT * FROM suppliers WHERE is_active = 1 ORDER BY name`;
  return db.prepare(sql).all();
}

export function getSupplierById(id) {
  return db.prepare(`SELECT * FROM suppliers WHERE id = ?`).get(Number(id));
}

export function createSupplier(data) {
  const requestedCode = String(data.code || "").trim().toUpperCase();
  const code = requestedCode || generateSupplierCode();
  const name = toTitleCase(data.name);

  if (!name) throw new Error("Supplier name is required.");

  const existing = db.prepare(`SELECT id FROM suppliers WHERE code = ?`).get(code);
  if (existing) throw new Error("A supplier with this internal code already exists.");

  const paymentTermsDays = normalizePaymentTerms(data);

  const result = db.prepare(`
    INSERT INTO suppliers (
      code, name, contact_person, phone, alternate_phone, email, gstin,
      address, city, state, pincode, payment_terms_days, notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    code,
    name,
    toTitleCase(data.contactPerson) || null,
    String(data.phone || "").trim() || null,
    String(data.alternatePhone || "").trim() || null,
    String(data.email || "").trim() || null,
    String(data.gstin || "").trim().toUpperCase() || null,
    String(data.address || "").trim() || null,
    toTitleCase(data.city) || null,
    toTitleCase(data.state) || null,
    String(data.pincode || "").trim() || null,
    paymentTermsDays,
    String(data.notes || "").trim() || null,
  );

  return getSupplierById(result.lastInsertRowid);
}

export function updateSupplier(id, data) {
  const supplierId = Number(id);
  const current = getSupplierById(supplierId);
  if (!current) throw new Error("Supplier not found.");

  const name = toTitleCase(data.name);
  if (!name) throw new Error("Supplier name is required.");

  const paymentTermsDays = normalizePaymentTerms(data);

  db.prepare(`
    UPDATE suppliers
    SET
      name = ?, contact_person = ?, phone = ?, alternate_phone = ?, email = ?,
      gstin = ?, address = ?, city = ?, state = ?, pincode = ?,
      payment_terms_days = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(
    name,
    toTitleCase(data.contactPerson) || null,
    String(data.phone || "").trim() || null,
    String(data.alternatePhone || "").trim() || null,
    String(data.email || "").trim() || null,
    String(data.gstin || "").trim().toUpperCase() || null,
    String(data.address || "").trim() || null,
    toTitleCase(data.city) || null,
    toTitleCase(data.state) || null,
    String(data.pincode || "").trim() || null,
    paymentTermsDays,
    String(data.notes || "").trim() || null,
    supplierId,
  );

  return getSupplierById(supplierId);
}

export function deactivateSupplier(id) {
  const supplier = getSupplierById(id);
  if (!supplier) throw new Error("Supplier not found.");
  db.prepare(`UPDATE suppliers SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(Number(id));
  return getSupplierById(id);
}

export function activateSupplier(id) {
  const supplier = getSupplierById(id);
  if (!supplier) throw new Error("Supplier not found.");
  db.prepare(`UPDATE suppliers SET is_active = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(Number(id));
  return getSupplierById(id);
}
