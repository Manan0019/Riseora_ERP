import {runBulkEdit} from "../utils/bulkItemEdit.js";
import { itemUnitPolicy, validateUnitCorrection } from "../utils/itemUnitPolicy.js";
import { convertQuantityWithDensity } from "./unitConversionService.js";
import db from "../db/database.js";
import { toTitleCase } from "../utils/textFormat.js";

function normalizePricing(data) {
  const defaultSellingPrice = Number(data.defaultSellingPrice || 0);
  const targetMarginPercent = Number(data.targetMarginPercent || 0);
  const defaultGstRate = Number(data.defaultGstRate || 0);

  if (!Number.isFinite(defaultSellingPrice) || defaultSellingPrice < 0) {
    throw new Error("Default selling price cannot be negative.");
  }
  if (!Number.isFinite(targetMarginPercent) || targetMarginPercent < 0 || targetMarginPercent >= 100) {
    throw new Error("Target margin must be between 0 and less than 100 percent.");
  }
  if (!Number.isFinite(defaultGstRate) || defaultGstRate < 0 || defaultGstRate > 100) {
    throw new Error("Default GST rate must be between 0 and 100 percent.");
  }
  return { defaultSellingPrice, targetMarginPercent, defaultGstRate };
}

function normalizeInventoryFields(data) {
  const categoryId = Number(data.categoryId);
  const baseUnitId = Number(data.baseUnitId);
  const reorderLevel = Number(data.reorderLevel || 0);
  const density = data.density === "" || data.density == null ? null : Number(data.density);

  if (!Number.isInteger(categoryId) || categoryId <= 0) throw new Error("Please select a valid item category.");
  if (!Number.isInteger(baseUnitId) || baseUnitId <= 0) throw new Error("Please select a valid base unit.");
  if (!Number.isFinite(reorderLevel) || reorderLevel < 0) throw new Error("Reorder level cannot be negative.");
  if (density != null && (!Number.isFinite(density) || density <= 0)) throw new Error("Density must be greater than zero when entered.");

  const category = db.prepare(`SELECT id, code, name, is_active, inventory_role FROM item_categories WHERE id = ?`).get(categoryId);
  const unit = db.prepare(`SELECT id, code, name, is_active FROM units WHERE id = ?`).get(baseUnitId);
  if (!category || Number(category.is_active) !== 1) throw new Error("Please select an active item category.");
  if (!unit || Number(unit.is_active) !== 1) throw new Error("Please select an active base unit.");

  const preferredEntryUnitId = data.preferredEntryUnitId == null || data.preferredEntryUnitId === "" ? null : Number(data.preferredEntryUnitId);
  if (preferredEntryUnitId != null) {
    const preferred = db.prepare('SELECT code, is_active FROM units WHERE id=?').get(preferredEntryUnitId);
    if (!preferred || Number(preferred.is_active)!==1) throw new Error('Select an active preferred entry unit.');
    convertQuantityWithDensity(1, preferred.code, unit.code, density, data.name || 'Item');
  }
  return { categoryId, categoryRole:String(category.inventory_role || category.code || "").toUpperCase(), baseUnitId, baseUnitCode:unit.code, reorderLevel, density, preferredEntryUnitId };
}

export function getItems(includeInactive = false, includeEditPolicy = false) {
  const sql = `
    SELECT
      i.*,
      EXISTS(SELECT 1 FROM tracked_inventory_items t WHERE t.id=i.id) AS automatic_lot_tracking,
      c.code AS category_code,
      c.name AS category_name,
      c.inventory_role AS category_role,
      u.code AS unit_code,
      u.name AS unit_name
    FROM items i
    INNER JOIN item_categories c ON c.id = i.category_id
    INNER JOIN units u ON u.id = i.base_unit_id
    ${includeInactive ? "" : "WHERE i.is_active = 1"}
    ORDER BY i.is_active DESC, i.name
  `;
  const rows = db.prepare(sql).all();
  return includeEditPolicy ? rows.map(item=>({...item,...itemUnitPolicy(db,item.id)})) : rows;
}

export function getItemById(id) {
  return db.prepare(`SELECT * FROM items WHERE id = ?`).get(Number(id));
}

// Displayed preview is advisory; a fresh collision-free code is assigned at save time.
export function getNextItemCode(categoryId) {
  const category = db.prepare(`SELECT name FROM item_categories WHERE id = ? AND is_active = 1`).get(Number(categoryId));
  if (!category) throw new Error("Select an active category first.");
  const firstWord = String(category.name || "").match(/[A-Za-z]+/)?.[0] || "ITM";
  const prefix = firstWord.toUpperCase().slice(0, 3);
  const codes = db.prepare(`SELECT code FROM items WHERE code LIKE ?`).all(`${prefix}-%`);
  let maxNumber = 0;
  for (const entry of codes) {
    const match = String(entry.code).match(new RegExp(`^${prefix}-(\\d+)$`, "i"));
    if (match) maxNumber = Math.max(maxNumber, Number(match[1]));
  }
  let nextNumber = maxNumber + 1;
  while (db.prepare(`SELECT id FROM items WHERE code = ?`).get(`${prefix}-${String(nextNumber).padStart(3, "0")}`)) {
    nextNumber += 1;
  }
  return `${prefix}-${String(nextNumber).padStart(3, "0")}`;
}

export function createItem(data) {
  const code = String(data.code || "").trim().toUpperCase() || getNextItemCode(data.categoryId);
  const name = toTitleCase(data.name);
  if (!name) throw new Error("Item name is required.");

  const duplicate = db.prepare(`SELECT id FROM items WHERE code = ?`).get(code);
  if (duplicate) throw new Error("An item with this code already exists.");

  const pricing = normalizePricing(data);
  const inventory = normalizeInventoryFields(data);

  const result = db.prepare(`
    INSERT INTO items (
      code, name, category_id, base_unit_id, reorder_level, track_lot,
      track_expiry, density, default_selling_price, target_margin_percent,
      hsn_code, default_gst_rate, notes, preferred_entry_unit_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
    String(data.hsnCode || "").trim().toUpperCase() || null,
    pricing.defaultGstRate,
    String(data.notes || "").trim() || null,
    inventory.preferredEntryUnitId,
  );

  return getItemById(result.lastInsertRowid);
}

export function updateItem(id, data) {
  return db.transaction(()=>updateItemAtomic(id,data)).immediate();
}
function updateItemAtomic(id, data) {
  const itemId = Number(id);
  const existingItem = getItemById(itemId);
  if (!existingItem) throw new Error("Item not found.");

  const code = String(data.code || "").trim().toUpperCase();
  const name = toTitleCase(data.name);
  if (!code) throw new Error("Item code is required.");
  if (!name) throw new Error("Item name is required.");

  const duplicate = db.prepare(`SELECT id FROM items WHERE code = ? AND id <> ?`).get(code, itemId);
  if (duplicate) throw new Error("An item with this code already exists.");

  const pricing = normalizePricing(data);
  const inventory = normalizeInventoryFields({...data, preferredEntryUnitId: Object.hasOwn(data,"preferredEntryUnitId") ? data.preferredEntryUnitId : existingItem.preferred_entry_unit_id});

  const currentCategory = db.prepare("SELECT inventory_role, code FROM item_categories WHERE id=?").get(existingItem.category_id);
  const oldRole = String(currentCategory?.inventory_role || currentCategory?.code || "").toUpperCase();
  validateUnitCorrection(itemUnitPolicy(db,itemId), {...existingItem, category_role:oldRole}, inventory, convertQuantityWithDensity);

  db.prepare(`
    UPDATE items
    SET code = ?, name = ?, category_id = ?, base_unit_id = ?, reorder_level = ?,
        track_lot = ?, track_expiry = ?, density = ?, default_selling_price = ?,
        target_margin_percent = ?, hsn_code = ?, default_gst_rate = ?, notes = ?, preferred_entry_unit_id = ?,
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
    String(data.hsnCode || "").trim().toUpperCase() || null,
    pricing.defaultGstRate,
    String(data.notes || "").trim() || null,
    inventory.preferredEntryUnitId,
    itemId,
  );

  return getItemById(itemId);
}

export function deactivateItem(id) {
  const itemId = Number(id);
  const item = getItemById(itemId);
  if (!item) throw new Error("Item not found.");

  const stock = Number(db.prepare(`
    SELECT COALESCE(SUM(quantity_in - quantity_out), 0) AS quantity
    FROM stock_transactions WHERE item_id = ?
  `).get(itemId)?.quantity || 0);

  if (Math.abs(stock) > 0.000001) {
    throw new Error(`Cannot deactivate ${item.name} while current stock is ${stock.toFixed(3)}. Bring stock to zero first.`);
  }

  const activeFormula = db.prepare(`
    SELECT f.code, f.version_no
    FROM formulas f
    LEFT JOIN formula_items fi ON fi.formula_id = f.id
    WHERE f.is_active = 1 AND (f.finished_item_id = ? OR fi.ingredient_item_id = ?)
    LIMIT 1
  `).get(itemId, itemId);

  if (activeFormula) {
    throw new Error(`Cannot deactivate this item while it is used by active formula ${activeFormula.code} V${activeFormula.version_no}.`);
  }

  db.prepare(`UPDATE items SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(itemId);
  return getItemById(itemId);
}

export function activateItem(id) {
  const itemId = Number(id);
  const item = getItemById(itemId);
  if (!item) throw new Error("Item not found.");
  db.prepare(`UPDATE items SET is_active = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(itemId);
  return getItemById(itemId);
}

export function bulkEditItems(body){return db.transaction(()=>runBulkEdit(db,body)).immediate();}
