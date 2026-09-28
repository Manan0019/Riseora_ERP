import db from "../db/database.js";
import { toTitleCase } from "../utils/textFormat.js";

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

function generateCustomerCode() {
  let nextId = Number(
    db.prepare(`SELECT COALESCE(MAX(id), 0) + 1 AS next_id FROM customers`).get()?.next_id || 1,
  );

  while (true) {
    const code = `CUS-${String(nextId).padStart(5, "0")}`;
    const exists = db.prepare(`SELECT 1 FROM customers WHERE code = ?`).get(code);
    if (!exists) return code;
    nextId += 1;
  }
}

export function getCustomers(includeInactive = false) {
  const sql = includeInactive
    ? `SELECT * FROM customers ORDER BY is_active DESC, name`
    : `SELECT * FROM customers WHERE is_active = 1 ORDER BY name`;
  return db.prepare(sql).all();
}

export function getCustomerById(id) {
  return db.prepare(`SELECT * FROM customers WHERE id = ?`).get(Number(id));
}

export function createCustomer(data) {
  const requestedCode = String(data.code || "").trim().toUpperCase();
  const code = requestedCode || generateCustomerCode();
  const name = toTitleCase(data.name);
  if (!name) throw new Error("Customer name is required.");

  const existing = db.prepare(`SELECT id FROM customers WHERE code = ?`).get(code);
  if (existing) throw new Error("A customer with this internal code already exists.");

  const terms = normalizeCustomerTerms(data);

  const result = db.prepare(`
    INSERT INTO customers (
      code, name, phone, alternate_phone, email, gstin, address, city, state,
      pincode, customer_type, credit_days, credit_limit, notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    code,
    name,
    String(data.phone || "").trim() || null,
    String(data.alternatePhone || "").trim() || null,
    String(data.email || "").trim() || null,
    String(data.gstin || "").trim().toUpperCase() || null,
    String(data.address || "").trim() || null,
    toTitleCase(data.city) || null,
    toTitleCase(data.state) || null,
    String(data.pincode || "").trim() || null,
    terms.customerType,
    terms.creditDays,
    terms.creditLimit,
    String(data.notes || "").trim() || null,
  );

  return getCustomerById(result.lastInsertRowid);
}

export function updateCustomer(id, data) {
  const customerId = Number(id);
  const current = getCustomerById(customerId);
  if (!current) throw new Error("Customer not found.");

  const name = toTitleCase(data.name);
  if (!name) throw new Error("Customer name is required.");
  const terms = normalizeCustomerTerms(data);

  db.prepare(`
    UPDATE customers
    SET
      name = ?, phone = ?, alternate_phone = ?, email = ?, gstin = ?, address = ?,
      city = ?, state = ?, pincode = ?, customer_type = ?, credit_days = ?,
      credit_limit = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(
    name,
    String(data.phone || "").trim() || null,
    String(data.alternatePhone || "").trim() || null,
    String(data.email || "").trim() || null,
    String(data.gstin || "").trim().toUpperCase() || null,
    String(data.address || "").trim() || null,
    toTitleCase(data.city) || null,
    toTitleCase(data.state) || null,
    String(data.pincode || "").trim() || null,
    terms.customerType,
    terms.creditDays,
    terms.creditLimit,
    String(data.notes || "").trim() || null,
    customerId,
  );

  return getCustomerById(customerId);
}

export function deactivateCustomer(id) {
  const customer = getCustomerById(id);
  if (!customer) throw new Error("Customer not found.");
  db.prepare(`UPDATE customers SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(Number(id));
  return getCustomerById(id);
}

export function activateCustomer(id) {
  const customer = getCustomerById(id);
  if (!customer) throw new Error("Customer not found.");
  db.prepare(`UPDATE customers SET is_active = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(Number(id));
  return getCustomerById(id);
}
