import db from "../db/database.js";

export function getUnits(includeInactive = false) {
  const query = includeInactive
    ? `
      SELECT *
      FROM units
      ORDER BY is_active DESC, code
    `
    : `
      SELECT *
      FROM units
      WHERE is_active = 1
      ORDER BY code
    `;

  return db.prepare(query).all();
}

export function getUnitById(id) {
  return db
    .prepare(`
      SELECT *
      FROM units
      WHERE id = ?
    `)
    .get(id);
}

export function createUnit(data) {
  const code = data.code.trim().toUpperCase();
  const name = data.name.trim();
  const unitType = data.unitType.trim().toUpperCase();

  const existing = db
    .prepare(`
      SELECT id
      FROM units
      WHERE code = ?
    `)
    .get(code);

  if (existing) {
    throw new Error("A unit with this code already exists.");
  }

  const result = db
    .prepare(`
      INSERT INTO units (
        code,
        name,
        unit_type
      )
      VALUES (?, ?, ?)
    `)
    .run(code, name, unitType);

  return getUnitById(result.lastInsertRowid);
}

export function updateUnit(id, data) {
  const code = data.code.trim().toUpperCase();
  const name = data.name.trim();
  const unitType = data.unitType.trim().toUpperCase();

  const existing = db
    .prepare(`
      SELECT id
      FROM units
      WHERE code = ?
        AND id <> ?
    `)
    .get(code, id);

  if (existing) {
    throw new Error("A unit with this code already exists.");
  }

  db.prepare(`
    UPDATE units
    SET
      code = ?,
      name = ?,
      unit_type = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(code, name, unitType, id);

  return getUnitById(id);
}

export function deactivateUnit(id) {
  db.prepare(`
    UPDATE units
    SET
      is_active = 0,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(id);

  return getUnitById(id);
}

export function activateUnit(id) {
  db.prepare(`
    UPDATE units
    SET
      is_active = 1,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(id);

  return getUnitById(id);
}