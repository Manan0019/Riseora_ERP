import db from "../db/database.js";

export function getItems(includeInactive = false) {
  const sql = `
    SELECT
      i.*,
      c.code AS category_code,
      c.name AS category_name,
      u.code AS unit_code,
      u.name AS unit_name
    FROM items i
    INNER JOIN item_categories c
      ON c.id = i.category_id
    INNER JOIN units u
      ON u.id = i.base_unit_id
    ${
      includeInactive
        ? ""
        : "WHERE i.is_active = 1"
    }
    ORDER BY i.is_active DESC, i.name
  `;

  return db.prepare(sql).all();
}

export function getItemById(id) {
  return db
    .prepare(`
      SELECT *
      FROM items
      WHERE id = ?
    `)
    .get(id);
}

export function createItem(data) {
  const code =
    data.code.trim().toUpperCase();

  const name =
    data.name.trim();

  const duplicate = db
    .prepare(`
      SELECT id
      FROM items
      WHERE code = ?
    `)
    .get(code);

  if (duplicate) {
    throw new Error(
      "An item with this code already exists."
    );
  }

  const result = db
    .prepare(`
      INSERT INTO items (
        code,
        name,
        category_id,
        base_unit_id,
        reorder_level,
        track_lot,
        track_expiry,
        density,
        notes
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    .run(
      code,
      name,
      Number(data.categoryId),
      Number(data.baseUnitId),
      Number(data.reorderLevel || 0),
      data.trackLot ? 1 : 0,
      data.trackExpiry ? 1 : 0,
      data.density
        ? Number(data.density)
        : null,
      data.notes?.trim() || null
    );

  return getItemById(
    result.lastInsertRowid
  );
}

export function updateItem(id, data) {
  const code =
    data.code.trim().toUpperCase();

  const name =
    data.name.trim();

  const duplicate = db
    .prepare(`
      SELECT id
      FROM items
      WHERE code = ?
        AND id <> ?
    `)
    .get(code, id);

  if (duplicate) {
    throw new Error(
      "An item with this code already exists."
    );
  }

  db.prepare(`
    UPDATE items
    SET
      code = ?,
      name = ?,
      category_id = ?,
      base_unit_id = ?,
      reorder_level = ?,
      track_lot = ?,
      track_expiry = ?,
      density = ?,
      notes = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(
    code,
    name,
    Number(data.categoryId),
    Number(data.baseUnitId),
    Number(data.reorderLevel || 0),
    data.trackLot ? 1 : 0,
    data.trackExpiry ? 1 : 0,
    data.density
      ? Number(data.density)
      : null,
    data.notes?.trim() || null,
    id
  );

  return getItemById(id);
}

export function deactivateItem(id) {
  db.prepare(`
    UPDATE items
    SET
      is_active = 0,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(id);

  return getItemById(id);
}

export function activateItem(id) {
  db.prepare(`
    UPDATE items
    SET
      is_active = 1,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(id);

  return getItemById(id);
}