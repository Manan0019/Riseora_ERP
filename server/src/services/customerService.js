import db from "../db/database.js";

const CUSTOMER_TYPES = new Set(["RETAIL", "WHOLESALE", "DISTRIBUTOR"]);

function normalizeCustomerTerms(data) {
  const creditDays = Number(data.creditDays || 0);
  const creditLimit = Number(data.creditLimit || 0);
  const customerType = String(data.customerType || "RETAIL").trim().toUpperCase();

  if (!Number.isInteger(creditDays) || creditDays < 0) {
    throw new Error("Credit days must be a non-negative whole number.");
  }
  if (!Number.isFinite(creditLimit) || creditLimit < 0) {
    throw new Error("Credit limit cannot be negative.");
  }
  if (!CUSTOMER_TYPES.has(customerType)) {
    throw new Error("Customer type must be RETAIL, WHOLESALE or DISTRIBUTOR.");
  }

  return { creditDays, creditLimit, customerType };
}

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

  const terms = normalizeCustomerTerms(data);

  const result = db
    .prepare(`
      INSERT INTO customers (
        code,
        name,
        phone,
        alternate_phone,
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
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    .run(
      code,
      name,
      data.phone?.trim() || null,
      data.alternatePhone?.trim() || null,
      data.email?.trim() || null,
      data.gstin?.trim().toUpperCase() || null,
      data.address?.trim() || null,
      data.city?.trim() || null,
      data.state?.trim() || null,
      data.pincode?.trim() || null,
      terms.customerType,
      terms.creditDays,
      terms.creditLimit,
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

  const terms = normalizeCustomerTerms(data);

  db.prepare(`
    UPDATE customers
    SET
      code = ?,
      name = ?,
      phone = ?,
      alternate_phone = ?,
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
    data.alternatePhone?.trim() || null,
    data.email?.trim() || null,
    data.gstin?.trim().toUpperCase() || null,
    data.address?.trim() || null,
    data.city?.trim() || null,
    data.state?.trim() || null,
    data.pincode?.trim() || null,
    terms.customerType,
    terms.creditDays,
    terms.creditLimit,
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