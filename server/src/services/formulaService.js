import db from "../db/database.js";
import { convertQuantityByUnitIds } from "./unitConversionService.js";

const ENTRY_MODES = new Set(["QUANTITY", "PERCENTAGE"]);
const PERCENT_TOLERANCE = 0.01;

const FORMULA_UNIT_DEFINITIONS = {
  ML: { family: "VOLUME", factorToBase: 1 },
  L: { family: "VOLUME", factorToBase: 1000 },
  G: { family: "WEIGHT", factorToBase: 1 },
  KG: { family: "WEIGHT", factorToBase: 1000 },
};

function convertFormulaQuantity(quantity, fromUnit, toUnit, density, itemName = "Component") {
  const qty = Number(quantity);
  if (!Number.isFinite(qty)) throw new Error(`${itemName}: invalid quantity.`);
  if (!fromUnit || !toUnit) throw new Error(`${itemName}: unit is missing.`);

  try {
    return convertQuantityByUnitIds(qty, Number(fromUnit.id), Number(toUnit.id));
  } catch (error) {
    const from = FORMULA_UNIT_DEFINITIONS[String(fromUnit.code || "").toUpperCase()];
    const to = FORMULA_UNIT_DEFINITIONS[String(toUnit.code || "").toUpperCase()];
    const isWeightVolumePair =
      from &&
      to &&
      from.family !== to.family &&
      [from.family, to.family].every((family) => ["WEIGHT", "VOLUME"].includes(family));

    if (!isWeightVolumePair) throw error;

    const itemDensity = Number(density);
    if (!Number.isFinite(itemDensity) || itemDensity <= 0) {
      throw new Error(
        `${itemName}: density is required in Item Master to convert between weight and volume. Enter density as g/mL (the same numeric value as kg/L), or use Quantity entry without cross-family conversion.`,
      );
    }

    if (from.family === "WEIGHT") {
      const grams = qty * from.factorToBase;
      const millilitres = grams / itemDensity;
      return millilitres / to.factorToBase;
    }

    const millilitres = qty * from.factorToBase;
    const grams = millilitres * itemDensity;
    return grams / to.factorToBase;
  }
}

function normalizeCode(value) {
  return String(value || "").trim().toUpperCase();
}

function normalizeEntryMode(value) {
  const mode = String(value || "QUANTITY").trim().toUpperCase();
  if (!ENTRY_MODES.has(mode)) {
    throw new Error("Formula entry method must be QUANTITY or PERCENTAGE.");
  }
  return mode;
}

function getFormulaUsageCount(id) {
  const row = db.prepare(`
    SELECT COUNT(*) AS count
    FROM production_batches
    WHERE formula_id = ?
      AND status <> 'CANCELLED'
  `).get(Number(id));
  return Number(row?.count || 0);
}

function getUnit(unitId) {
  return db.prepare(`
    SELECT id, code, name, unit_type, is_active
    FROM units
    WHERE id = ?
  `).get(Number(unitId));
}

function getFormulaComponentItem(itemId) {
  return db.prepare(`
    SELECT
      i.id,
      i.code,
      i.name,
      i.base_unit_id,
      i.is_active,
      i.density,
      c.code AS category_code,
      c.name AS category_name,
      c.inventory_role AS category_role
    FROM items i
    INNER JOIN item_categories c ON c.id = i.category_id
    WHERE i.id = ?
  `).get(Number(itemId));
}

function validateFinishedProduct(data) {
  const finishedItem = getFormulaComponentItem(data.finishedItemId);
  if (!finishedItem) throw new Error("Finished product was not found.");
  if (Number(finishedItem.is_active) !== 1) {
    throw new Error("Inactive finished products cannot be used on a new or revised formula.");
  }
  if (finishedItem.category_role !== "FG") {
    throw new Error("Finished product must belong to the FG category.");
  }

  const batchSize = Number(data.batchSize);
  const batchUnitId = Number(data.batchUnitId);
  if (!Number.isFinite(batchSize) || batchSize <= 0) {
    throw new Error("Formula batch size must be greater than zero.");
  }

  const batchUnit = getUnit(batchUnitId);
  if (!batchUnit || Number(batchUnit.is_active) !== 1) {
    throw new Error("Please select an active batch unit.");
  }

  try {
    convertQuantityByUnitIds(1, batchUnitId, Number(finishedItem.base_unit_id));
  } catch {
    throw new Error("Formula batch unit must be compatible with the finished product base unit.");
  }

  return { finishedItem, batchSize, batchUnitId };
}

function tryDeriveQuantityModePercentages(ingredients) {
  const rawRows = ingredients.filter(
    (row) => row.componentRole === "FORMULA" && row.categoryRole === "RAW",
  );
  if (rawRows.length === 0) return { derived: false, ingredients };

  const firstUnit = getUnit(rawRows[0].unitId);
  if (!firstUnit || !["WEIGHT", "VOLUME"].includes(firstUnit.unit_type)) {
    return { derived: false, ingredients };
  }

  let converted;
  try {
    converted = rawRows.map((row) => ({
      row,
      quantity: convertFormulaQuantity(
        row.quantity,
        getUnit(row.unitId),
        firstUnit,
        row.density,
        row.itemName,
      ),
    }));
  } catch {
    return { derived: false, ingredients };
  }

  const total = converted.reduce((sum, value) => sum + Number(value.quantity || 0), 0);
  if (!Number.isFinite(total) || total <= 0) return { derived: false, ingredients };

  const percentageByItem = new Map(
    converted.map(({ row, quantity }) => [
      row.ingredientItemId,
      (Number(quantity) / total) * 100,
    ]),
  );

  return {
    derived: true,
    ingredients: ingredients.map((row) => ({
      ...row,
      percentage:
        row.componentRole === "FORMULA" && row.categoryRole === "RAW"
          ? percentageByItem.get(row.ingredientItemId)
          : null,
    })),
  };
}

function normalizeFormulaData(data) {
  const { batchSize, batchUnitId } = validateFinishedProduct(data);
  const entryMode = normalizeEntryMode(data.entryMode);

  if (!Array.isArray(data.ingredients) || data.ingredients.length === 0) {
    throw new Error("At least one formula component is required.");
  }

  const processExtras = Array.isArray(data.processExtras) ? data.processExtras : [];

  let compositionSize = null;
  let compositionUnitId = null;
  let compositionUnit = null;

  if (entryMode === "PERCENTAGE") {
    compositionSize = Number(data.compositionSize);
    compositionUnitId = Number(data.compositionUnitId);
    if (!Number.isFinite(compositionSize) || compositionSize <= 0) {
      throw new Error("Composition total must be greater than zero for a percentage formula.");
    }
    compositionUnit = getUnit(compositionUnitId);
    if (!compositionUnit || Number(compositionUnit.is_active) !== 1) {
      throw new Error("Please select an active composition unit.");
    }
    if (!["WEIGHT", "VOLUME"].includes(compositionUnit.unit_type)) {
      throw new Error("Percentage formulas must use a weight or volume composition unit.");
    }
  }

  const validateBaseRow = (ingredient, index, componentRole) => {
    const ingredientItemId = Number(ingredient.ingredientItemId);
    if (!ingredientItemId) {
      throw new Error(`${componentRole === "PROCESS_EXTRA" ? "Process extra" : "Component"} is required in row ${index + 1}.`);
    }
    if (ingredientItemId === Number(data.finishedItemId)) {
      throw new Error(`Finished product cannot also be used as a component in row ${index + 1}.`);
    }

    const item = getFormulaComponentItem(ingredientItemId);
    if (!item) throw new Error(`Formula component was not found in row ${index + 1}.`);
    if (Number(item.is_active) !== 1) {
      throw new Error(`${item.name}: inactive items cannot be used on a new or revised formula.`);
    }

    const unitId = Number(ingredient.unitId);
    const unit = getUnit(unitId);
    if (!unit || Number(unit.is_active) !== 1) {
      throw new Error(`${item.name}: select an active component unit.`);
    }
    try {
      convertQuantityByUnitIds(1, unitId, Number(item.base_unit_id));
    } catch {
      throw new Error(`${item.name}: component unit is not compatible with the item's base unit.`);
    }

    return { ingredientItemId, item, unitId, unit };
  };

  const seenFormulaIds = new Set();
  let rawPercentageTotal = 0;
  let rawCount = 0;

  let ingredients = data.ingredients.map((ingredient, index) => {
    const { ingredientItemId, item, unitId, unit } = validateBaseRow(
      ingredient,
      index,
      "FORMULA",
    );

    if (seenFormulaIds.has(ingredientItemId)) {
      throw new Error(`The same formula component cannot be entered more than once. Check row ${index + 1}.`);
    }
    seenFormulaIds.add(ingredientItemId);

    if (!["RAW", "PACK"].includes(item.category_role)) {
      throw new Error(`${item.name} must have a RAW or PACK inventory role before it can be used in a formula.`);
    }

    let quantity = Number(ingredient.quantity);
    let percentage =
      ingredient.percentage === "" || ingredient.percentage == null
        ? null
        : Number(ingredient.percentage);

    if (item.category_role === "RAW") {
      rawCount += 1;

      if (entryMode === "PERCENTAGE") {
        if (!Number.isFinite(percentage) || percentage <= 0 || percentage > 100) {
          throw new Error(`${item.name}: percentage must be greater than 0 and no more than 100%.`);
        }
        rawPercentageTotal += percentage;
        if (rawPercentageTotal > 100 + PERCENT_TOLERANCE) {
          throw new Error(`Raw-material percentage total cannot exceed 100%. Current total: ${rawPercentageTotal.toFixed(2)}%.`);
        }

        const quantityInCompositionUnit = compositionSize * (percentage / 100);
        try {
          quantity = convertFormulaQuantity(
            quantityInCompositionUnit,
            compositionUnit,
            unit,
            item.density,
            item.name,
          );
        } catch (error) {
          throw new Error(error.message || `${item.name}: cannot convert the percentage basis to ${unit.code}.`);
        }
      } else {
        if (!Number.isFinite(quantity) || quantity <= 0) {
          throw new Error(`${item.name}: component quantity must be greater than zero.`);
        }
        if (percentage != null && (!Number.isFinite(percentage) || percentage < 0 || percentage > 100)) {
          throw new Error(`${item.name}: percentage must be between 0 and 100.`);
        }
      }
    } else {
      if (!Number.isFinite(quantity) || quantity <= 0) {
        throw new Error(`${item.name}: packaging quantity must be greater than zero.`);
      }
      percentage = null;
    }

    return {
      ingredientItemId,
      quantity,
      unitId,
      percentage,
      notes: ingredient.notes?.trim() || "",
      componentRole: "FORMULA",
      extraReason: null,
      categoryCode: item.category_code,
      categoryName: item.category_name,
      categoryRole: item.category_role,
      density: item.density == null ? null : Number(item.density),
      itemName: item.name,
    };
  });

  if (entryMode === "PERCENTAGE") {
    if (rawCount === 0) {
      throw new Error("A percentage formula must contain at least one RAW material component.");
    }
    if (Math.abs(rawPercentageTotal - 100) > PERCENT_TOLERANCE) {
      const remaining = 100 - rawPercentageTotal;
      throw new Error(
        remaining > 0
          ? `Raw-material percentages must total exactly 100% before saving. ${remaining.toFixed(2)}% remains.`
          : `Raw-material percentage total cannot exceed 100%. Current total: ${rawPercentageTotal.toFixed(2)}%.`,
      );
    }
  } else {
    const derived = tryDeriveQuantityModePercentages(ingredients);
    ingredients = derived.ingredients;
    if (!derived.derived) {
      const enteredTotal = ingredients
        .filter((row) => row.componentRole === "FORMULA" && row.categoryRole === "RAW" && row.percentage != null)
        .reduce((sum, row) => sum + Number(row.percentage || 0), 0);
      if (enteredTotal > 100 + PERCENT_TOLERANCE) {
        throw new Error(`Raw-material percentage total cannot exceed 100%. Current total: ${enteredTotal.toFixed(2)}%.`);
      }
    }
  }

  const seenExtraIds = new Set();
  const normalizedExtras = processExtras.map((ingredient, index) => {
    const { ingredientItemId, item, unitId } = validateBaseRow(
      ingredient,
      index,
      "PROCESS_EXTRA",
    );

    if (seenExtraIds.has(ingredientItemId)) {
      throw new Error(`The same process-extra ingredient cannot be entered more than once. Check extra row ${index + 1}.`);
    }
    seenExtraIds.add(ingredientItemId);

    if (item.category_role !== "RAW") {
      throw new Error(`${item.name}: process allowance / extra ingredients must have a RAW inventory role.`);
    }

    const quantity = Number(ingredient.quantity);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      throw new Error(`${item.name}: extra quantity must be greater than zero.`);
    }

    const extraReason = String(ingredient.extraReason || ingredient.reason || "").trim();
    if (!extraReason) {
      throw new Error(`${item.name}: reason is required for process allowance / extra material.`);
    }

    return {
      ingredientItemId,
      quantity,
      unitId,
      percentage: null,
      notes: ingredient.notes?.trim() || "",
      componentRole: "PROCESS_EXTRA",
      extraReason,
      categoryCode: item.category_code,
      categoryName: item.category_name,
      categoryRole: item.category_role,
      density: item.density == null ? null : Number(item.density),
      itemName: item.name,
    };
  });

  return {
    code: normalizeCode(data.code),
    name: String(data.name || "").trim(),
    finishedItemId: Number(data.finishedItemId),
    versionNo: Number(data.versionNo || 1),
    batchSize,
    batchUnitId,
    entryMode,
    compositionSize,
    compositionUnitId,
    notes: String(data.notes || "").trim(),
    ingredients: [...ingredients, ...normalizedExtras],
  };
}

function insertFormulaItems(formulaId, ingredients) {
  const insertIngredient = db.prepare(`
    INSERT INTO formula_items (
      formula_id,
      ingredient_item_id,
      quantity,
      unit_id,
      percentage,
      sequence_no,
      notes,
      component_role,
      extra_reason
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  let formulaSequence = 0;
  let extraSequence = 0;

  ingredients.forEach((ingredient) => {
    const role = ingredient.componentRole === "PROCESS_EXTRA" ? "PROCESS_EXTRA" : "FORMULA";
    const sequenceNo = role === "PROCESS_EXTRA" ? ++extraSequence : ++formulaSequence;

    insertIngredient.run(
      Number(formulaId),
      Number(ingredient.ingredientItemId),
      Number(ingredient.quantity),
      Number(ingredient.unitId),
      ingredient.percentage == null ? null : Number(ingredient.percentage),
      sequenceNo,
      ingredient.notes?.trim() || null,
      role,
      role === "PROCESS_EXTRA" ? ingredient.extraReason?.trim() || null : null,
    );
  });
}

export function getFormulas(includeInactive = false) {
  return db.prepare(`
    SELECT
      f.id,
      f.code,
      f.name,
      f.version_no,
      f.batch_size,
      f.entry_mode,
      f.composition_size,
      f.composition_unit_id,
      f.is_active,
      f.notes,
      i.id AS finished_item_id,
      i.code AS finished_item_code,
      i.name AS finished_item_name,
      u.id AS batch_unit_id,
      u.code AS batch_unit_code,
      u.name AS batch_unit_name,
      cu.code AS composition_unit_code,
      cu.name AS composition_unit_name,
      (
        SELECT COUNT(*)
        FROM production_batches pb
        WHERE pb.formula_id = f.id
          AND pb.status <> 'CANCELLED'
      ) AS production_count,
      CASE
        WHEN EXISTS (
          SELECT 1
          FROM production_batches pb
          WHERE pb.formula_id = f.id
            AND pb.status <> 'CANCELLED'
        )
        OR EXISTS (
          SELECT 1
          FROM formulas newer
          WHERE newer.code = f.code
            AND newer.version_no > f.version_no
        )
        THEN 1 ELSE 0
      END AS is_locked
    FROM formulas f
    INNER JOIN items i ON i.id = f.finished_item_id
    INNER JOIN units u ON u.id = f.batch_unit_id
    LEFT JOIN units cu ON cu.id = f.composition_unit_id
    ${includeInactive ? "" : "WHERE f.is_active = 1"}
    ORDER BY f.code, f.version_no DESC, f.id DESC
  `).all();
}

export function getFormulaById(id) {
  const formula = db.prepare(`
    SELECT
      f.*,
      i.code AS finished_item_code,
      i.name AS finished_item_name,
      u.code AS batch_unit_code,
      u.name AS batch_unit_name,
      cu.code AS composition_unit_code,
      cu.name AS composition_unit_name,
      (
        SELECT COUNT(*)
        FROM production_batches pb
        WHERE pb.formula_id = f.id
          AND pb.status <> 'CANCELLED'
      ) AS production_count,
      CASE
        WHEN EXISTS (
          SELECT 1
          FROM production_batches pb
          WHERE pb.formula_id = f.id
            AND pb.status <> 'CANCELLED'
        )
        THEN 1 ELSE 0
      END AS is_locked
    FROM formulas f
    INNER JOIN items i ON i.id = f.finished_item_id
    INNER JOIN units u ON u.id = f.batch_unit_id
    LEFT JOIN units cu ON cu.id = f.composition_unit_id
    WHERE f.id = ?
  `).get(Number(id));

  if (!formula) return null;

  const ingredients = db.prepare(`
    SELECT
      fi.id,
      fi.ingredient_item_id,
      fi.quantity,
      fi.unit_id,
      fi.percentage,
      fi.sequence_no,
      fi.notes,
      fi.component_role,
      fi.extra_reason,
      i.code AS ingredient_code,
      i.name AS ingredient_name,
      c.code AS category_code,
      c.name AS category_name,
      c.inventory_role AS category_role,
      u.code AS unit_code,
      u.name AS unit_name,
      u.unit_type AS unit_type
    FROM formula_items fi
    INNER JOIN items i ON i.id = fi.ingredient_item_id
    INNER JOIN item_categories c ON c.id = i.category_id
    INNER JOIN units u ON u.id = fi.unit_id
    WHERE fi.formula_id = ?
    ORDER BY CASE WHEN fi.component_role = 'PROCESS_EXTRA' THEN 1 ELSE 0 END, fi.sequence_no, fi.id
  `).all(Number(id));

  return { ...formula, ingredients };
}

export function createFormula(data) {
  const transaction = db.transaction(() => {
    const normalized = normalizeFormulaData(data);
    const existingCode = db.prepare(`SELECT id FROM formulas WHERE code = ? LIMIT 1`).get(normalized.code);
    if (existingCode) {
      throw new Error("This formula code already exists. Open the existing formula and use Create New Version.");
    }

    const result = db.prepare(`
      INSERT INTO formulas (
        code, name, finished_item_id, version_no,
        batch_size, batch_unit_id, entry_mode,
        composition_size, composition_unit_id,
        notes, is_active
      )
      VALUES (?, ?, ?, 1, ?, ?, ?, ?, ?, ?, 1)
    `).run(
      normalized.code,
      normalized.name,
      normalized.finishedItemId,
      normalized.batchSize,
      normalized.batchUnitId,
      normalized.entryMode,
      normalized.compositionSize,
      normalized.compositionUnitId,
      normalized.notes || null,
    );

    const formulaId = Number(result.lastInsertRowid);
    insertFormulaItems(formulaId, normalized.ingredients);
    return { formulaId, code: normalized.code, versionNo: 1 };
  });
  return transaction();
}

export function updateFormula(id, data) {
  const transaction = db.transaction(() => {
    const formula = db.prepare(`SELECT * FROM formulas WHERE id = ?`).get(Number(id));
    if (!formula) throw new Error("Formula not found.");

    const usageCount = getFormulaUsageCount(id);
    if (usageCount > 0) {
      throw new Error(
        `Version ${formula.version_no} has already been used in ${usageCount} production batch${usageCount === 1 ? "" : "es"}. Create a new formula version instead of changing this recipe.`,
      );
    }

    const newerVersion = db.prepare(`
      SELECT id, version_no
      FROM formulas
      WHERE code = ? AND version_no > ?
      ORDER BY version_no DESC
      LIMIT 1
    `).get(formula.code, formula.version_no);
    if (newerVersion) {
      throw new Error(
        `Version ${formula.version_no} is historical because V${newerVersion.version_no} already exists. Create a new version from the current active formula instead.`,
      );
    }

    const normalized = normalizeFormulaData(data);
    if (normalized.code !== normalizeCode(formula.code)) {
      throw new Error("Formula code cannot be changed after creation.");
    }
    if (Number(normalized.versionNo) !== Number(formula.version_no)) {
      throw new Error("Formula version number cannot be edited manually.");
    }

    db.prepare(`
      UPDATE formulas
      SET
        name = ?,
        finished_item_id = ?,
        batch_size = ?,
        batch_unit_id = ?,
        entry_mode = ?,
        composition_size = ?,
        composition_unit_id = ?,
        notes = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      normalized.name,
      normalized.finishedItemId,
      normalized.batchSize,
      normalized.batchUnitId,
      normalized.entryMode,
      normalized.compositionSize,
      normalized.compositionUnitId,
      normalized.notes || null,
      Number(id),
    );

    db.prepare(`DELETE FROM formula_items WHERE formula_id = ?`).run(Number(id));
    insertFormulaItems(Number(id), normalized.ingredients);

    return {
      formulaId: Number(id),
      code: formula.code,
      versionNo: Number(formula.version_no),
    };
  });
  return transaction();
}

export function createFormulaVersion(sourceFormulaId, data) {
  const transaction = db.transaction(() => {
    const source = db.prepare(`SELECT * FROM formulas WHERE id = ?`).get(Number(sourceFormulaId));
    if (!source) throw new Error("Source formula not found.");

    const latest = db.prepare(`
      SELECT id, version_no, is_active
      FROM formulas
      WHERE code = ?
      ORDER BY version_no DESC
      LIMIT 1
    `).get(source.code);

    if (Number(latest?.id) !== Number(source.id) || Number(source.is_active) !== 1) {
      throw new Error("Only the current active/latest formula version can be used to create a new version.");
    }

    const normalized = normalizeFormulaData(data);
    const sourceCode = normalizeCode(source.code);
    if (normalized.code !== sourceCode) {
      throw new Error("Formula code cannot be changed when creating a new version.");
    }

    const versionRow = db.prepare(`
      SELECT COALESCE(MAX(version_no), 0) + 1 AS next_version
      FROM formulas
      WHERE code = ?
    `).get(sourceCode);
    const nextVersion = Number(versionRow?.next_version || 1);

    db.prepare(`
      UPDATE formulas
      SET is_active = 0, updated_at = CURRENT_TIMESTAMP
      WHERE code = ?
    `).run(sourceCode);

    const result = db.prepare(`
      INSERT INTO formulas (
        code, name, finished_item_id, version_no,
        batch_size, batch_unit_id, entry_mode,
        composition_size, composition_unit_id,
        notes, is_active
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
    `).run(
      sourceCode,
      normalized.name,
      normalized.finishedItemId,
      nextVersion,
      normalized.batchSize,
      normalized.batchUnitId,
      normalized.entryMode,
      normalized.compositionSize,
      normalized.compositionUnitId,
      normalized.notes || null,
    );

    const formulaId = Number(result.lastInsertRowid);
    insertFormulaItems(formulaId, normalized.ingredients);

    return {
      formulaId,
      code: sourceCode,
      versionNo: nextVersion,
      sourceFormulaId: Number(sourceFormulaId),
    };
  });
  return transaction();
}

export function deactivateFormula(id) {
  const result = db.prepare(`
    UPDATE formulas
    SET is_active = 0, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(Number(id));
  if (result.changes === 0) throw new Error("Formula not found.");
}

export function activateFormula(id) {
  const transaction = db.transaction(() => {
    const formula = db.prepare(`SELECT * FROM formulas WHERE id = ?`).get(Number(id));
    if (!formula) throw new Error("Formula not found.");

    const latestVersion = db.prepare(`
      SELECT MAX(version_no) AS version_no
      FROM formulas
      WHERE code = ?
    `).get(formula.code);

    if (Number(formula.version_no) !== Number(latestVersion?.version_no || 0)) {
      throw new Error("Only the latest formula version can be activated. Create a new version if you need to restore an older recipe.");
    }

    db.prepare(`
      UPDATE formulas
      SET is_active = 0, updated_at = CURRENT_TIMESTAMP
      WHERE code = ?
    `).run(formula.code);

    db.prepare(`
      UPDATE formulas
      SET is_active = 1, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(Number(id));

    return {
      formulaId: Number(id),
      code: formula.code,
      versionNo: Number(formula.version_no),
    };
  });
  return transaction();
}
