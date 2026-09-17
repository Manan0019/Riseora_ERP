import db from "../db/database.js";

export function getCustomers(includeInactive = false) {
  const sql = includeInactive
    ? `
      SELECT *
      FROM customers
      ORDER BY is_active DESC, name
    `
    : `
      SELECT *
      FROM customers
      WHERE is_active = 1
      ORDER BY name
    `;

  return db.prepare(sql).all();
}

export function getCustomerById(id) {
  return db
    .prepare(`
      SELECT *
      FROM customers
      WHERE id = ?
    `)
    .get(id);
}

export function createCustomer(data) {
  const code = data.code.trim().toUpperCase();
  const name = data.name.trim();

  const existing = db
    .prepare(`
      SELECT id
      FROM customers
      WHERE code = ?
    `)
    .get(code);

  if (existing) {
    throw new Error(
      "A customer with this code already exists."
    );
  }

  const result = db
    .prepare(`
      INSERT INTO customers (
        code,
        name,
        phone,
        email,
        gstin,
        address,
        city,
        state,
        pincode,
        customer_type,
        credit_days,
        credit_limit,
        notes
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    .run(
      code,
      name,
      data.phone?.trim() || null,
      data.email?.trim() || null,
      data.gstin?.trim().toUpperCase() || null,
      data.address?.trim() || null,
      data.city?.trim() || null,
      data.state?.trim() || null,
      data.pincode?.trim() || null,
      data.customerType || "RETAIL",
      Number(data.creditDays || 0),
      Number(data.creditLimit || 0),
      data.notes?.trim() || null
    );

  return getCustomerById(result.lastInsertRowid);
}

export function updateCustomer(id, data) {
  const code = data.code.trim().toUpperCase();
  const name = data.name.trim();

  const duplicate = db
    .prepare(`
      SELECT id
      FROM customers
      WHERE code = ?
        AND id <> ?
    `)
    .get(code, id);

  if (duplicate) {
    throw new Error(
      "A customer with this code already exists."
    );
  }

  db.prepare(`
    UPDATE customers
    SET
      code = ?,
      name = ?,
      phone = ?,
      email = ?,
      gstin = ?,
      address = ?,
      city = ?,
      state = ?,
      pincode = ?,
      customer_type = ?,
      credit_days = ?,
      credit_limit = ?,
      notes = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(
    code,
    name,
    data.phone?.trim() || null,
    data.email?.trim() || null,
    data.gstin?.trim().toUpperCase() || null,
    data.address?.trim() || null,
    data.city?.trim() || null,
    data.state?.trim() || null,
    data.pincode?.trim() || null,
    data.customerType || "RETAIL",
    Number(data.creditDays || 0),
    Number(data.creditLimit || 0),
    data.notes?.trim() || null,
    id
  );

  return getCustomerById(id);
}

export function deactivateCustomer(id) {
  db.prepare(`
    UPDATE customers
    SET
      is_active = 0,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(id);

  return getCustomerById(id);
}

export function activateCustomer(id) {
  db.prepare(`
    UPDATE customers
    SET
      is_active = 1,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(id);

  return getCustomerById(id);
}