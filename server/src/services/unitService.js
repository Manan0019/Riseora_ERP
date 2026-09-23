import db from "../db/database.js";

const UNIT_TYPES = new Set(["VOLUME", "WEIGHT", "COUNT"]);
const SYSTEM_CONVERSION_CODES = new Set(["ML", "L", "G", "KG", "PCS"]);

function normalizeUnit(data) {
  const code = String(data.code || "").trim().toUpperCase();
  const name = String(data.name || "").trim();
  const unitType = String(data.unitType || "").trim().toUpperCase();
  if (!code) throw new Error("Unit code is required.");
  if (!name) throw new Error("Unit name is required.");
  if (!UNIT_TYPES.has(unitType)) {
    throw new Error("Unit type must be VOLUME, WEIGHT or COUNT.");
  }
  return { code, name, unitType };
}

function unitUsage(id) {
  const itemCount = Number(db.prepare(`SELECT COUNT(*) AS count FROM items WHERE base_unit_id = ?`).get(id)?.count || 0);
  const formulaBatchCount = Number(db.prepare(`SELECT COUNT(*) AS count FROM formulas WHERE batch_unit_id = ?`).get(id)?.count || 0);
  const ingredientCount = Number(db.prepare(`SELECT COUNT(*) AS count FROM formula_items WHERE unit_id = ?`).get(id)?.count || 0);
  const activeItemCount = Number(db.prepare(`SELECT COUNT(*) AS count FROM items WHERE base_unit_id = ? AND is_active = 1`).get(id)?.count || 0);
  const activeFormulaCount = Number(db.prepare(`SELECT COUNT(*) AS count FROM formulas WHERE batch_unit_id = ? AND is_active = 1`).get(id)?.count || 0);
  const activeIngredientCount = Number(db.prepare(`
    SELECT COUNT(*) AS count
    FROM formula_items fi
    INNER JOIN formulas f ON f.id = fi.formula_id
    WHERE fi.unit_id = ? AND f.is_active = 1
  `).get(id)?.count || 0);
  return {
    any: itemCount + formulaBatchCount + ingredientCount > 0,
    active: activeItemCount + activeFormulaCount + activeIngredientCount > 0,
  };
}

export function getUnits(includeInactive = false) {
  const query = includeInactive
    ? `SELECT * FROM units ORDER BY is_active DESC, code`
    : `SELECT * FROM units WHERE is_active = 1 ORDER BY code`;
  return db.prepare(query).all();
}

export function getUnitById(id) {
  return db.prepare(`SELECT * FROM units WHERE id = ?`).get(Number(id));
}

export function createUnit(data) {
  const normalized = normalizeUnit(data);
  const existing = db.prepare(`SELECT id FROM units WHERE code = ?`).get(normalized.code);
  if (existing) throw new Error("A unit with this code already exists.");

  const result = db.prepare(`
    INSERT INTO units (code, name, unit_type)
    VALUES (?, ?, ?)
  `).run(normalized.code, normalized.name, normalized.unitType);
  return getUnitById(result.lastInsertRowid);
}

export function updateUnit(id, data) {
  const unitId = Number(id);
  const current = getUnitById(unitId);
  if (!current) throw new Error("Unit not found.");

  const normalized = normalizeUnit(data);
  const duplicate = db.prepare(`SELECT id FROM units WHERE code = ? AND id <> ?`).get(normalized.code, unitId);
  if (duplicate) throw new Error("A unit with this code already exists.");

  const usage = unitUsage(unitId);
  if (usage.any && (normalized.code !== current.code || normalized.unitType !== current.unit_type)) {
    throw new Error("Unit code/type cannot be changed after the unit has been used by an item or formula. Create a new unit instead.");
  }
  if (SYSTEM_CONVERSION_CODES.has(current.code) && normalized.code !== current.code) {
    throw new Error(`${current.code} is a system conversion unit. Its code cannot be changed.`);
  }

  db.prepare(`
    UPDATE units
    SET code = ?, name = ?, unit_type = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(normalized.code, normalized.name, normalized.unitType, unitId);
  return getUnitById(unitId);
}

export function deactivateUnit(id) {
  const unitId = Number(id);
  const unit = getUnitById(unitId);
  if (!unit) throw new Error("Unit not found.");
  const usage = unitUsage(unitId);
  if (usage.active) {
    throw new Error("This unit is used by an active item or formula and cannot be deactivated.");
  }
  db.prepare(`UPDATE units SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(unitId);
  return getUnitById(unitId);
}

export function activateUnit(id) {
  const unitId = Number(id);
  const unit = getUnitById(unitId);
  if (!unit) throw new Error("Unit not found.");
  db.prepare(`UPDATE units SET is_active = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(unitId);
  return getUnitById(unitId);
}
