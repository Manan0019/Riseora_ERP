import db from "../db/database.js";

function normalizePaymentTerms(data) {
  const days = Number(data.paymentTermsDays || 0);
  if (!Number.isInteger(days) || days < 0) {
    throw new Error("Payment terms must be a non-negative whole number of days.");
  }
  return days;
}

export function getSuppliers(includeInactive = false) {
  const sql = includeInactive
    ? `
      SELECT *
      FROM suppliers
      ORDER BY is_active DESC, name
    `
    : `
      SELECT *
      FROM suppliers
      WHERE is_active = 1
      ORDER BY name
    `;

  return db.prepare(sql).all();
}

export function getSupplierById(id) {
  return db
    .prepare(`
      SELECT *
      FROM suppliers
      WHERE id = ?
    `)
    .get(id);
}

export function createSupplier(data) {
  const code = data.code.trim().toUpperCase();
  const name = data.name.trim();

  const existing = db
    .prepare(`
      SELECT id
      FROM suppliers
      WHERE code = ?
    `)
    .get(code);

  if (existing) {
    throw new Error(
      "A supplier with this code already exists."
    );
  }

  const paymentTermsDays = normalizePaymentTerms(data);

  const result = db
    .prepare(`
      INSERT INTO suppliers (
        code,
        name,
        contact_person,
        phone,
        alternate_phone,
        email,
        gstin,
        address,
        city,
        state,
        pincode,
        payment_terms_days,
        notes
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    .run(
      code,
      name,
      data.contactPerson?.trim() || null,
      data.phone?.trim() || null,
      data.alternatePhone?.trim() || null,
      data.email?.trim() || null,
      data.gstin?.trim().toUpperCase() || null,
      data.address?.trim() || null,
      data.city?.trim() || null,
      data.state?.trim() || null,
      data.pincode?.trim() || null,
      paymentTermsDays,
      data.notes?.trim() || null
    );

  return getSupplierById(result.lastInsertRowid);
}

export function updateSupplier(id, data) {
  const code = data.code.trim().toUpperCase();
  const name = data.name.trim();

  const duplicate = db
    .prepare(`
      SELECT id
      FROM suppliers
      WHERE code = ?
        AND id <> ?
    `)
    .get(code, id);

  if (duplicate) {
    throw new Error(
      "A supplier with this code already exists."
    );
  }

  const paymentTermsDays = normalizePaymentTerms(data);

  db.prepare(`
    UPDATE suppliers
    SET
      code = ?,
      name = ?,
      contact_person = ?,
      phone = ?,
      alternate_phone = ?,
      email = ?,
      gstin = ?,
      address = ?,
      city = ?,
      state = ?,
      pincode = ?,
      payment_terms_days = ?,
      notes = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(
    code,
    name,
    data.contactPerson?.trim() || null,
    data.phone?.trim() || null,
    data.alternatePhone?.trim() || null,
    data.email?.trim() || null,
    data.gstin?.trim().toUpperCase() || null,
    data.address?.trim() || null,
    data.city?.trim() || null,
    data.state?.trim() || null,
    data.pincode?.trim() || null,
    paymentTermsDays,
    data.notes?.trim() || null,
    id
  );

  return getSupplierById(id);
}

export function deactivateSupplier(id) {
  db.prepare(`
    UPDATE suppliers
    SET
      is_active = 0,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(id);

  return getSupplierById(id);
}

export function activateSupplier(id) {
  db.prepare(`
    UPDATE suppliers
    SET
      is_active = 1,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(id);

  return getSupplierById(id);
}