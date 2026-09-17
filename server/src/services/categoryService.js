import db from "../db/database.js";

export function getCategories(includeInactive = false) {
  const query = includeInactive
    ? `
      SELECT *
      FROM item_categories
      ORDER BY is_active DESC, code
    `
    : `
      SELECT *
      FROM item_categories
      WHERE is_active = 1
      ORDER BY code
    `;

  return db.prepare(query).all();
}

export function getCategoryById(id) {
  return db
    .prepare(`
      SELECT *
      FROM item_categories
      WHERE id = ?
    `)
    .get(id);
}

export function createCategory(data) {
  const code = data.code.trim().toUpperCase();
  const name = data.name.trim();

  const existing = db
    .prepare(`
      SELECT id
      FROM item_categories
      WHERE code = ?
    `)
    .get(code);

  if (existing) {
    throw new Error("A category with this code already exists.");
  }

  const result = db
    .prepare(`
      INSERT INTO item_categories (
        code,
        name
      )
      VALUES (?, ?)
    `)
    .run(code, name);

  return getCategoryById(result.lastInsertRowid);
}

export function updateCategory(id, data) {
  const code = data.code.trim().toUpperCase();
  const name = data.name.trim();

  const existing = db
    .prepare(`
      SELECT id
      FROM item_categories
      WHERE code = ?
        AND id <> ?
    `)
    .get(code, id);

  if (existing) {
    throw new Error("A category with this code already exists.");
  }

  db.prepare(`
    UPDATE item_categories
    SET
      code = ?,
      name = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(code, name, id);

  return getCategoryById(id);
}

export function deactivateCategory(id) {
  db.prepare(`
    UPDATE item_categories
    SET
      is_active = 0,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(id);

  return getCategoryById(id);
}

export function activateCategory(id) {
  db.prepare(`
    UPDATE item_categories
    SET
      is_active = 1,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(id);

  return getCategoryById(id);
}