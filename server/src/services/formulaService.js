import db from "../db/database.js";

export function getFormulas(includeInactive = false) {
  return db.prepare(`
    SELECT
      f.id,
      f.code,
      f.name,
      f.version_no,
      f.batch_size,
      f.is_active,
      f.notes,

      i.id AS finished_item_id,
      i.code AS finished_item_code,
      i.name AS finished_item_name,

      u.id AS batch_unit_id,
      u.code AS batch_unit_code,
      u.name AS batch_unit_name

    FROM formulas f

    INNER JOIN items i
      ON i.id = f.finished_item_id

    INNER JOIN units u
      ON u.id = f.batch_unit_id

    ${
      includeInactive
        ? ""
        : "WHERE f.is_active = 1"
    }

    ORDER BY
      f.name,
      f.version_no DESC
  `).all();
}

export function getFormulaById(id) {
  const formula = db.prepare(`
    SELECT
      f.*,

      i.code AS finished_item_code,
      i.name AS finished_item_name,

      u.code AS batch_unit_code,
      u.name AS batch_unit_name

    FROM formulas f

    INNER JOIN items i
      ON i.id = f.finished_item_id

    INNER JOIN units u
      ON u.id = f.batch_unit_id

    WHERE f.id = ?
  `).get(id);

  if (!formula) {
    return null;
  }

  const ingredients = db.prepare(`
    SELECT
      fi.id,
      fi.ingredient_item_id,
      fi.quantity,
      fi.unit_id,
      fi.percentage,
      fi.sequence_no,
      fi.notes,

      i.code AS ingredient_code,
      i.name AS ingredient_name,

      u.code AS unit_code,
      u.name AS unit_name

    FROM formula_items fi

    INNER JOIN items i
      ON i.id = fi.ingredient_item_id

    INNER JOIN units u
      ON u.id = fi.unit_id

    WHERE fi.formula_id = ?

    ORDER BY
      fi.sequence_no,
      fi.id
  `).all(id);

  return {
    ...formula,
    ingredients,
  };
}

export function createFormula(data) {
  const transaction = db.transaction(() => {
    const existing = db.prepare(`
      SELECT id
      FROM formulas
      WHERE code = ?
        AND version_no = ?
    `).get(
      data.code.trim().toUpperCase(),
      Number(data.versionNo || 1)
    );

    if (existing) {
      throw new Error(
        "Formula code and version already exist."
      );
    }

    const result = db.prepare(`
      INSERT INTO formulas (
        code,
        name,
        finished_item_id,
        version_no,
        batch_size,
        batch_unit_id,
        notes
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      data.code.trim().toUpperCase(),
      data.name.trim(),
      Number(data.finishedItemId),
      Number(data.versionNo || 1),
      Number(data.batchSize),
      Number(data.batchUnitId),
      data.notes?.trim() || null
    );

    const formulaId =
      Number(result.lastInsertRowid);

    const insertIngredient =
      db.prepare(`
        INSERT INTO formula_items (
          formula_id,
          ingredient_item_id,
          quantity,
          unit_id,
          percentage,
          sequence_no,
          notes
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

    data.ingredients.forEach(
      (ingredient, index) => {
        insertIngredient.run(
          formulaId,
          Number(
            ingredient.ingredientItemId
          ),
          Number(
            ingredient.quantity
          ),
          Number(
            ingredient.unitId
          ),
          ingredient.percentage === "" ||
          ingredient.percentage == null
            ? null
            : Number(
                ingredient.percentage
              ),
          index + 1,
          ingredient.notes?.trim() ||
            null
        );
      }
    );

    return {
      formulaId,
      code:
        data.code.trim().toUpperCase(),
      versionNo:
        Number(data.versionNo || 1),
    };
  });

  return transaction();
}

export function updateFormula(
  id,
  data
) {
  const transaction = db.transaction(() => {
    const formula = db.prepare(`
      SELECT *
      FROM formulas
      WHERE id = ?
    `).get(id);

    if (!formula) {
      throw new Error(
        "Formula not found."
      );
    }

    const duplicate = db.prepare(`
      SELECT id
      FROM formulas
      WHERE code = ?
        AND version_no = ?
        AND id <> ?
    `).get(
      data.code.trim().toUpperCase(),
      Number(data.versionNo || 1),
      id
    );

    if (duplicate) {
      throw new Error(
        "Formula code and version already exist."
      );
    }

    db.prepare(`
      UPDATE formulas
      SET
        code = ?,
        name = ?,
        finished_item_id = ?,
        version_no = ?,
        batch_size = ?,
        batch_unit_id = ?,
        notes = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      data.code.trim().toUpperCase(),
      data.name.trim(),
      Number(data.finishedItemId),
      Number(data.versionNo || 1),
      Number(data.batchSize),
      Number(data.batchUnitId),
      data.notes?.trim() || null,
      id
    );

    db.prepare(`
      DELETE FROM formula_items
      WHERE formula_id = ?
    `).run(id);

    const insertIngredient =
      db.prepare(`
        INSERT INTO formula_items (
          formula_id,
          ingredient_item_id,
          quantity,
          unit_id,
          percentage,
          sequence_no,
          notes
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

    data.ingredients.forEach(
      (ingredient, index) => {
        insertIngredient.run(
          id,
          Number(
            ingredient.ingredientItemId
          ),
          Number(
            ingredient.quantity
          ),
          Number(
            ingredient.unitId
          ),
          ingredient.percentage === "" ||
          ingredient.percentage == null
            ? null
            : Number(
                ingredient.percentage
              ),
          index + 1,
          ingredient.notes?.trim() ||
            null
        );
      }
    );

    return {
      formulaId: id,
    };
  });

  return transaction();
}

export function deactivateFormula(id) {
  const result = db.prepare(`
    UPDATE formulas
    SET
      is_active = 0,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(id);

  if (result.changes === 0) {
    throw new Error(
      "Formula not found."
    );
  }
}

export function activateFormula(id) {
  const result = db.prepare(`
    UPDATE formulas
    SET
      is_active = 1,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(id);

  if (result.changes === 0) {
    throw new Error(
      "Formula not found."
    );
  }
}