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
        gstin
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      data.name,
      data.legalName || null,
      data.address || null,
      data.city || null,
      data.state || null,
      data.pincode || null,
      data.phone || null,
      data.email || null,
      data.gstin || null
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
    existing.id
  );

  return db
    .prepare(`SELECT * FROM companies WHERE id = ?`)
    .get(existing.id);
}