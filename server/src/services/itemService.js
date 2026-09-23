import db from "../db/database.js";

function normalizePricing(data) {
  const defaultSellingPrice = Number(data.defaultSellingPrice || 0);
  const targetMarginPercent = Number(data.targetMarginPercent || 0);
  const defaultGstRate = Number(data.defaultGstRate || 0);

  if (!Number.isFinite(defaultSellingPrice) || defaultSellingPrice < 0) {
    throw new Error("Default selling price cannot be negative.");
  }

  if (
    !Number.isFinite(targetMarginPercent) ||
    targetMarginPercent < 0 ||
    targetMarginPercent >= 100
  ) {
    throw new Error("Target margin must be between 0 and less than 100 percent.");
  }

  if (!Number.isFinite(defaultGstRate) || defaultGstRate < 0 || defaultGstRate > 100) {
    throw new Error("Default GST rate must be between 0 and 100 percent.");
  }

  return {
    defaultSellingPrice,
    targetMarginPercent,
    defaultGstRate,
  };
}

function normalizeInventoryFields(data) {
  const categoryId = Number(data.categoryId);
  const baseUnitId = Number(data.baseUnitId);
  const reorderLevel = Number(data.reorderLevel || 0);
  const density = data.density === "" || data.density == null
    ? null
    : Number(data.density);

  if (!Number.isInteger(categoryId) || categoryId <= 0) {
    throw new Error("Please select a valid item category.");
  }
  if (!Number.isInteger(baseUnitId) || baseUnitId <= 0) {
    throw new Error("Please select a valid base unit.");
  }
  if (!Number.isFinite(reorderLevel) || reorderLevel < 0) {
    throw new Error("Reorder level cannot be negative.");
  }
  if (density != null && (!Number.isFinite(density) || density <= 0)) {
    throw new Error("Density must be greater than zero when entered.");
  }

  const category = db.prepare(`
    SELECT id, code, name, is_active
    FROM item_categories
    WHERE id = ?
  `).get(categoryId);
  const unit = db.prepare(`
    SELECT id, code, name, is_active
    FROM units
    WHERE id = ?
  `).get(baseUnitId);

  if (!category || Number(category.is_active) !== 1) {
    throw new Error("Please select an active item category.");
  }
  if (!unit || Number(unit.is_active) !== 1) {
    throw new Error("Please select an active base unit.");
  }

  return { categoryId, baseUnitId, reorderLevel, density };
}

function itemHasBusinessHistory(itemId) {
  const row = db.prepare(`
    SELECT
      EXISTS(SELECT 1 FROM stock_transactions WHERE item_id = ? LIMIT 1)
      OR EXISTS(SELECT 1 FROM formula_items WHERE ingredient_item_id = ? LIMIT 1)
      OR EXISTS(SELECT 1 FROM formulas WHERE finished_item_id = ? LIMIT 1)
      OR EXISTS(SELECT 1 FROM sales_items WHERE item_id = ? LIMIT 1)
      OR EXISTS(SELECT 1 FROM purchase_items WHERE item_id = ? LIMIT 1)
      OR EXISTS(SELECT 1 FROM production_batches WHERE finished_item_id = ? LIMIT 1)
      AS has_history
  `).get(itemId, itemId, itemId, itemId, itemId, itemId);

  return Number(row?.has_history || 0) === 1;
}

export function getItems(includeInactive = false) {
  const sql = `
    SELECT
      i.*,
      c.code AS category_code,
      c.name AS category_name,
      c.inventory_role AS category_role,
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

  const pricing = normalizePricing(data);
  const inventory = normalizeInventoryFields(data);

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
        default_selling_price,
        target_margin_percent,
        hsn_code,
        default_gst_rate,
        notes
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    .run(
      code,
      name,
      inventory.categoryId,
      inventory.baseUnitId,
      inventory.reorderLevel,
      data.trackLot ? 1 : 0,
      data.trackExpiry ? 1 : 0,
      inventory.density,
      pricing.defaultSellingPrice,
      pricing.targetMarginPercent,
      data.hsnCode?.trim().toUpperCase() || null,
      pricing.defaultGstRate,
      data.notes?.trim() || null
    );

  return getItemById(
    result.lastInsertRowid
  );
}

export function updateItem(id, data) {
  const existingItem = getItemById(Number(id));
  if (!existingItem) {
    throw new Error("Item not found.");
  }

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

  const pricing = normalizePricing(data);
  const inventory = normalizeInventoryFields(data);

  if (itemHasBusinessHistory(Number(id))) {
    if (Number(existingItem.base_unit_id) !== inventory.baseUnitId) {
      throw new Error("Base unit cannot be changed after an item has business history. Create a new item if a different stock unit is required.");
    }
    if (Number(existingItem.category_id) !== inventory.categoryId) {
      throw new Error("Item category cannot be changed after an item has business history. Create a new item if the business classification has changed.");
    }
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
      default_selling_price = ?,
      target_margin_percent = ?,
      hsn_code = ?,
      default_gst_rate = ?,
      notes = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(
    code,
    name,
    inventory.categoryId,
    inventory.baseUnitId,
    inventory.reorderLevel,
    data.trackLot ? 1 : 0,
    data.trackExpiry ? 1 : 0,
    inventory.density,
    pricing.defaultSellingPrice,
    pricing.targetMarginPercent,
    data.hsnCode?.trim().toUpperCase() || null,
    pricing.defaultGstRate,
    data.notes?.trim() || null,
    id
  );

  return getItemById(id);
}

export function deactivateItem(id) {
  const item = getItemById(Number(id));
  if (!item) throw new Error("Item not found.");

  const stock = Number(db.prepare(`
    SELECT COALESCE(SUM(quantity_in - quantity_out), 0) AS quantity
    FROM stock_transactions
    WHERE item_id = ?
  `).get(Number(id))?.quantity || 0);

  if (Math.abs(stock) > 0.000001) {
    throw new Error(`Cannot deactivate ${item.name} while current stock is ${stock.toFixed(3)}. Bring stock to zero first.`);
  }

  const activeFormula = db.prepare(`
    SELECT f.code, f.version_no
    FROM formulas f
    LEFT JOIN formula_items fi ON fi.formula_id = f.id
    WHERE f.is_active = 1
      AND (f.finished_item_id = ? OR fi.ingredient_item_id = ?)
    LIMIT 1
  `).get(Number(id), Number(id));

  if (activeFormula) {
    throw new Error(`Cannot deactivate this item while it is used by active formula ${activeFormula.code} V${activeFormula.version_no}.`);
  }

  db.prepare(`
    UPDATE items
    SET
      is_active = 0,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(Number(id));

  return getItemById(Number(id));
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
