import db from "../db/database.js";
import { toTitleCase } from "../utils/textFormat.js";

const INVENTORY_ROLES = new Set(["RAW", "PACK", "FG", "CONS"]);

function normalizeCategory(data) {
  const name = toTitleCase(data.name);
  const inventoryRole = String(data.inventoryRole || data.inventory_role || "CONS")
    .trim()
    .toUpperCase();

  if (!name) throw new Error("Category name is required.");
  if (!INVENTORY_ROLES.has(inventoryRole)) {
    throw new Error("Inventory role must be RAW, PACK, FG or CONS.");
  }

  return { name, inventoryRole };
}

function categorySelect(where = "") {
  return `
    SELECT
      c.*,
      (SELECT COUNT(*) FROM items i WHERE i.category_id = c.id) AS item_count
    FROM item_categories c
    ${where}
  `;
}

function generateInternalCategoryCode() {
  const row = db.prepare(`SELECT COALESCE(MAX(id), 0) AS max_id FROM item_categories`).get();
  let nextNumber = Number(row?.max_id || 0) + 1;

  while (true) {
    const code = `CAT-${String(nextNumber).padStart(5, "0")}`;
    const existing = db.prepare(`SELECT id FROM item_categories WHERE code = ?`).get(code);
    if (!existing) return code;
    nextNumber += 1;
  }
}

function ensureUniqueName(name, excludeId = null) {
  const duplicate = excludeId == null
    ? db.prepare(`
        SELECT id
        FROM item_categories
        WHERE LOWER(TRIM(name)) = LOWER(TRIM(?))
        LIMIT 1
      `).get(name)
    : db.prepare(`
        SELECT id
        FROM item_categories
        WHERE LOWER(TRIM(name)) = LOWER(TRIM(?))
          AND id <> ?
        LIMIT 1
      `).get(name, Number(excludeId));

  if (duplicate) {
    throw new Error("A category with this name already exists.");
  }
}

export function getCategories(includeInactive = false) {
  const query = includeInactive
    ? `${categorySelect()} ORDER BY c.is_active DESC, c.name`
    : `${categorySelect("WHERE c.is_active = 1")} ORDER BY c.name`;

  return db.prepare(query).all();
}

export function getCategoryById(id) {
  return db.prepare(`${categorySelect("WHERE c.id = ?")}`).get(Number(id));
}

export function createCategory(data) {
  const normalized = normalizeCategory(data);
  ensureUniqueName(normalized.name);

  const code = generateInternalCategoryCode();
  const result = db.prepare(`
    INSERT INTO item_categories (code, name, inventory_role)
    VALUES (?, ?, ?)
  `).run(code, normalized.name, normalized.inventoryRole);

  return getCategoryById(result.lastInsertRowid);
}

export function updateCategory(id, data) {
  const categoryId = Number(id);
  const current = getCategoryById(categoryId);

  if (!current) {
    throw new Error("Category not found.");
  }

  const normalized = normalizeCategory(data);
  ensureUniqueName(normalized.name, categoryId);

  /*
   * The database code is retained only as an internal technical identifier for
   * backward compatibility with catalog/legacy records. It is intentionally
   * not user-editable anymore. Items remain linked by category_id.
   */
  const itemCount = Number(current.item_count || 0);
  if (
    itemCount > 0 &&
    normalized.inventoryRole !== String(current.inventory_role || "CONS").toUpperCase()
  ) {
    throw new Error(
      "Inventory role cannot be changed after items have been assigned. Category name can still be changed.",
    );
  }

  db.prepare(`
    UPDATE item_categories
    SET
      name = ?,
      inventory_role = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(
    normalized.name,
    normalized.inventoryRole,
    categoryId,
  );

  return getCategoryById(categoryId);
}

export function deactivateCategory(id) {
  const categoryId = Number(id);
  const category = getCategoryById(categoryId);

  if (!category) {
    throw new Error("Category not found.");
  }

  const activeItems = Number(db.prepare(`
    SELECT COUNT(*) AS count
    FROM items
    WHERE category_id = ?
      AND is_active = 1
  `).get(categoryId)?.count || 0);

  if (activeItems > 0) {
    throw new Error("This category is used by active items. Deactivate or move those items first.");
  }

  db.prepare(`
    UPDATE item_categories
    SET is_active = 0, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(categoryId);

  return getCategoryById(categoryId);
}

export function activateCategory(id) {
  const categoryId = Number(id);
  const category = getCategoryById(categoryId);

  if (!category) {
    throw new Error("Category not found.");
  }

  db.prepare(`
    UPDATE item_categories
    SET is_active = 1, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(categoryId);

  return getCategoryById(categoryId);
}
