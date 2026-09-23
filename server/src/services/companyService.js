import db from "../db/database.js";

export function getCompany() {
  return db
    .prepare(`
      SELECT
        id,
        name,
        legal_name,
        address,
        city,
        state,
        pincode,
        phone,
        email,
        gstin,
        bank_name,
        bank_account_name,
        bank_account_no,
        bank_ifsc,
        upi_id,
        invoice_terms,
        is_active,
        created_at,
        updated_at
      FROM companies
      ORDER BY id
      LIMIT 1
    `)
    .get();
}

export function saveCompany(data) {
  const existing = getCompany();

  if (!existing) {
    const result = db.prepare(`
      INSERT INTO companies (
        name,
        legal_name,
        address,
        city,
        state,
        pincode,
        phone,
        email,
        gstin,
        bank_name,
        bank_account_name,
        bank_account_no,
        bank_ifsc,
        upi_id,
        invoice_terms
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      data.name,
      data.legalName || null,
      data.address || null,
      data.city || null,
      data.state || null,
      data.pincode || null,
      data.phone || null,
      data.email || null,
      data.gstin || null,
      data.bankName?.trim() || null,
      data.bankAccountName?.trim() || null,
      data.bankAccountNo?.trim() || null,
      data.bankIfsc?.trim().toUpperCase() || null,
      data.upiId?.trim() || null,
      data.invoiceTerms?.trim() || null
    );

    return db
      .prepare(`SELECT * FROM companies WHERE id = ?`)
      .get(result.lastInsertRowid);
  }

  db.prepare(`
    UPDATE companies
    SET
      name = ?,
      legal_name = ?,
      address = ?,
      city = ?,
      state = ?,
      pincode = ?,
      phone = ?,
      email = ?,
      gstin = ?,
      bank_name = ?,
      bank_account_name = ?,
      bank_account_no = ?,
      bank_ifsc = ?,
      upi_id = ?,
      invoice_terms = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(
    data.name,
    data.legalName || null,
    data.address || null,
    data.city || null,
    data.state || null,
    data.pincode || null,
    data.phone || null,
    data.email || null,
    data.gstin || null,
    data.bankName?.trim() || null,
    data.bankAccountName?.trim() || null,
    data.bankAccountNo?.trim() || null,
    data.bankIfsc?.trim().toUpperCase() || null,
    data.upiId?.trim() || null,
    data.invoiceTerms?.trim() || null,
    existing.id
  );

  return db
    .prepare(`SELECT * FROM companies WHERE id = ?`)
    .get(existing.id);
}