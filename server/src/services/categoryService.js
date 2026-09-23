import db from "../db/database.js";

const SYSTEM_CATEGORY_CODES = new Set(["RAW", "PACK", "FG", "CONS"]);

function normalizeCategory(data) {
  const code = String(data.code || "").trim().toUpperCase();
  const name = String(data.name || "").trim();
  if (!code) throw new Error("Category code is required.");
  if (!name) throw new Error("Category name is required.");
  return { code, name };
}

export function getCategories(includeInactive = false) {
  const query = includeInactive
    ? `SELECT * FROM item_categories ORDER BY is_active DESC, code`
    : `SELECT * FROM item_categories WHERE is_active = 1 ORDER BY code`;
  return db.prepare(query).all();
}

export function getCategoryById(id) {
  return db.prepare(`SELECT * FROM item_categories WHERE id = ?`).get(Number(id));
}

export function createCategory(data) {
  const normalized = normalizeCategory(data);
  const existing = db.prepare(`SELECT id FROM item_categories WHERE code = ?`).get(normalized.code);
  if (existing) throw new Error("A category with this code already exists.");
  const result = db.prepare(`INSERT INTO item_categories (code, name) VALUES (?, ?)`).run(normalized.code, normalized.name);
  return getCategoryById(result.lastInsertRowid);
}

export function updateCategory(id, data) {
  const categoryId = Number(id);
  const current = getCategoryById(categoryId);
  if (!current) throw new Error("Category not found.");
  const normalized = normalizeCategory(data);
  const duplicate = db.prepare(`SELECT id FROM item_categories WHERE code = ? AND id <> ?`).get(normalized.code, categoryId);
  if (duplicate) throw new Error("A category with this code already exists.");

  const itemCount = Number(db.prepare(`SELECT COUNT(*) AS count FROM items WHERE category_id = ?`).get(categoryId)?.count || 0);
  if (itemCount > 0 && normalized.code !== current.code) {
    throw new Error("Category code cannot be changed after items have been assigned to it. Create a new category instead.");
  }
  if (SYSTEM_CATEGORY_CODES.has(current.code) && normalized.code !== current.code) {
    throw new Error(`${current.code} is a system manufacturing category. Its code cannot be changed.`);
  }

  db.prepare(`
    UPDATE item_categories
    SET code = ?, name = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(normalized.code, normalized.name, categoryId);
  return getCategoryById(categoryId);
}

export function deactivateCategory(id) {
  const categoryId = Number(id);
  const category = getCategoryById(categoryId);
  if (!category) throw new Error("Category not found.");
  const activeItems = Number(db.prepare(`SELECT COUNT(*) AS count FROM items WHERE category_id = ? AND is_active = 1`).get(categoryId)?.count || 0);
  if (activeItems > 0) {
    throw new Error("This category is used by active items. Deactivate or move those items first.");
  }
  db.prepare(`UPDATE item_categories SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(categoryId);
  return getCategoryById(categoryId);
}

export function activateCategory(id) {
  const categoryId = Number(id);
  const category = getCategoryById(categoryId);
  if (!category) throw new Error("Category not found.");
  db.prepare(`UPDATE item_categories SET is_active = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(categoryId);
  return getCategoryById(categoryId);
}
