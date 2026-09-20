import db from "../db/database.js";

function normalizeCode(value) {
  return String(value || "")
    .trim()
    .toUpperCase();
}

function getFormulaUsageCount(id) {
  const row = db.prepare(`
    SELECT COUNT(*) AS count
    FROM production_batches
    WHERE formula_id = ?
  `).get(Number(id));

  return Number(row?.count || 0);
}

function assertFormulaItems(data) {
  const finishedItemId =
    Number(data.finishedItemId);

  const finishedItem =
    db.prepare(`
      SELECT
        i.id,
        i.code,
        i.name,
        c.code AS category_code
      FROM items i
      INNER JOIN item_categories c
        ON c.id = i.category_id
      WHERE i.id = ?
    `).get(finishedItemId);

  if (!finishedItem) {
    throw new Error(
      "Finished product was not found."
    );
  }

  if (
    finishedItem.category_code !==
    "FG"
  ) {
    throw new Error(
      "Finished product must belong to the FG category."
    );
  }

  const seenIngredientIds =
    new Set();

  for (
    let index = 0;
    index < data.ingredients.length;
    index++
  ) {
    const ingredient =
      data.ingredients[index];

    const ingredientItemId =
      Number(
        ingredient.ingredientItemId
      );

    if (
      seenIngredientIds.has(
        ingredientItemId
      )
    ) {
      throw new Error(
        `The same formula component cannot be entered more than once. Check row ${
          index + 1
        }.`
      );
    }

    seenIngredientIds.add(
      ingredientItemId
    );

    if (
      ingredientItemId ===
      finishedItemId
    ) {
      throw new Error(
        `Finished product cannot also be used as a component in row ${
          index + 1
        }.`
      );
    }

    const item =
      db.prepare(`
        SELECT
          i.id,
          i.code,
          i.name,
          c.code AS category_code
        FROM items i
        INNER JOIN item_categories c
          ON c.id = i.category_id
        WHERE i.id = ?
      `).get(
        ingredientItemId
      );

    if (!item) {
      throw new Error(
        `Formula component was not found in row ${
          index + 1
        }.`
      );
    }

    if (
      item.category_code !== "RAW" &&
      item.category_code !== "PACK"
    ) {
      throw new Error(
        `${item.name} must belong to RAW or PACK before it can be used in a formula.`
      );
    }
  }
}

function insertFormulaItems(
  formulaId,
  ingredients
) {
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

  ingredients.forEach(
    (
      ingredient,
      index
    ) => {
      insertIngredient.run(
        Number(formulaId),

        Number(
          ingredient
            .ingredientItemId
        ),

        Number(
          ingredient.quantity
        ),

        Number(
          ingredient.unitId
        ),

        ingredient.percentage ===
            "" ||
          ingredient.percentage ==
            null
          ? null
          : Number(
              ingredient
                .percentage
            ),

        index + 1,

        ingredient.notes
          ?.trim() || null
      );
    }
  );
}

export function getFormulas(
  includeInactive = false
) {
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
      u.name AS batch_unit_name,

      (
        SELECT COUNT(*)
        FROM production_batches pb
        WHERE pb.formula_id = f.id
      ) AS production_count,

      CASE
        WHEN EXISTS (
          SELECT 1
          FROM production_batches pb
          WHERE pb.formula_id = f.id
        )
        THEN 1
        ELSE 0
      END AS is_locked

    FROM formulas f

    INNER JOIN items i
      ON i.id =
         f.finished_item_id

    INNER JOIN units u
      ON u.id =
         f.batch_unit_id

    ${
      includeInactive
        ? ""
        : "WHERE f.is_active = 1"
    }

    ORDER BY
      f.code,
      f.version_no DESC,
      f.id DESC
  `).all();
}

export function getFormulaById(
  id
) {
  const formula =
    db.prepare(`
      SELECT
        f.*,

        i.code AS finished_item_code,
        i.name AS finished_item_name,

        u.code AS batch_unit_code,
        u.name AS batch_unit_name,

        (
          SELECT COUNT(*)
          FROM production_batches pb
          WHERE pb.formula_id = f.id
        ) AS production_count,

        CASE
          WHEN EXISTS (
            SELECT 1
            FROM production_batches pb
            WHERE pb.formula_id = f.id
          )
          THEN 1
          ELSE 0
        END AS is_locked

      FROM formulas f

      INNER JOIN items i
        ON i.id =
           f.finished_item_id

      INNER JOIN units u
        ON u.id =
           f.batch_unit_id

      WHERE f.id = ?
    `).get(
      Number(id)
    );

  if (!formula) {
    return null;
  }

  const ingredients =
    db.prepare(`
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

        c.code AS category_code,
        c.name AS category_name,

        u.code AS unit_code,
        u.name AS unit_name

      FROM formula_items fi

      INNER JOIN items i
        ON i.id =
           fi.ingredient_item_id

      INNER JOIN item_categories c
        ON c.id =
           i.category_id

      INNER JOIN units u
        ON u.id =
           fi.unit_id

      WHERE fi.formula_id = ?

      ORDER BY
        fi.sequence_no,
        fi.id
    `).all(
      Number(id)
    );

  return {
    ...formula,
    ingredients,
  };
}

export function createFormula(
  data
) {
  const transaction =
    db.transaction(() => {
      assertFormulaItems(
        data
      );

      const code =
        normalizeCode(
          data.code
        );

      const existingCode =
        db.prepare(`
          SELECT id
          FROM formulas
          WHERE code = ?
          LIMIT 1
        `).get(code);

      if (existingCode) {
        throw new Error(
          "This formula code already exists. Open the existing formula and use Create New Version."
        );
      }

      const result =
        db.prepare(`
          INSERT INTO formulas (
            code,
            name,
            finished_item_id,
            version_no,
            batch_size,
            batch_unit_id,
            notes,
            is_active
          )
          VALUES (?, ?, ?, 1, ?, ?, ?, 1)
        `).run(
          code,

          data.name.trim(),

          Number(
            data.finishedItemId
          ),

          Number(
            data.batchSize
          ),

          Number(
            data.batchUnitId
          ),

          data.notes
            ?.trim() ||
            null
        );

      const formulaId =
        Number(
          result.lastInsertRowid
        );

      insertFormulaItems(
        formulaId,
        data.ingredients
      );

      return {
        formulaId,
        code,
        versionNo: 1,
      };
    });

  return transaction();
}

export function updateFormula(
  id,
  data
) {
  const transaction =
    db.transaction(() => {
      const formula =
        db.prepare(`
          SELECT *
          FROM formulas
          WHERE id = ?
        `).get(
          Number(id)
        );

      if (!formula) {
        throw new Error(
          "Formula not found."
        );
      }

      const usageCount =
        getFormulaUsageCount(
          id
        );

      if (
        usageCount > 0
      ) {
        throw new Error(
          `Version ${formula.version_no} has already been used in ${usageCount} production batch${
            usageCount === 1
              ? ""
              : "es"
          }. Create a new formula version instead of changing this recipe.`
        );
      }

      assertFormulaItems(
        data
      );

      const submittedCode =
        normalizeCode(
          data.code
        );

      if (
        submittedCode !==
        normalizeCode(
          formula.code
        )
      ) {
        throw new Error(
          "Formula code cannot be changed after creation."
        );
      }

      if (
        Number(
          data.versionNo
        ) !==
        Number(
          formula.version_no
        )
      ) {
        throw new Error(
          "Formula version number cannot be edited manually."
        );
      }

      db.prepare(`
        UPDATE formulas
        SET
          name = ?,
          finished_item_id = ?,
          batch_size = ?,
          batch_unit_id = ?,
          notes = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(
        data.name.trim(),

        Number(
          data.finishedItemId
        ),

        Number(
          data.batchSize
        ),

        Number(
          data.batchUnitId
        ),

        data.notes
          ?.trim() ||
          null,

        Number(id)
      );

      db.prepare(`
        DELETE FROM formula_items
        WHERE formula_id = ?
      `).run(
        Number(id)
      );

      insertFormulaItems(
        Number(id),
        data.ingredients
      );

      return {
        formulaId:
          Number(id),

        code:
          formula.code,

        versionNo:
          Number(
            formula.version_no
          ),
      };
    });

  return transaction();
}

export function createFormulaVersion(
  sourceFormulaId,
  data
) {
  const transaction =
    db.transaction(() => {
      const source =
        db.prepare(`
          SELECT *
          FROM formulas
          WHERE id = ?
        `).get(
          Number(
            sourceFormulaId
          )
        );

      if (!source) {
        throw new Error(
          "Source formula not found."
        );
      }

      assertFormulaItems(
        data
      );

      const sourceCode =
        normalizeCode(
          source.code
        );

      const submittedCode =
        normalizeCode(
          data.code
        );

      if (
        submittedCode !==
        sourceCode
      ) {
        throw new Error(
          "Formula code cannot be changed when creating a new version."
        );
      }

      const versionRow =
        db.prepare(`
          SELECT
            COALESCE(
              MAX(version_no),
              0
            ) + 1 AS next_version
          FROM formulas
          WHERE code = ?
        `).get(
          sourceCode
        );

      const nextVersion =
        Number(
          versionRow
            ?.next_version ||
            1
        );

      db.prepare(`
        UPDATE formulas
        SET
          is_active = 0,
          updated_at = CURRENT_TIMESTAMP
        WHERE code = ?
      `).run(
        sourceCode
      );

      const result =
        db.prepare(`
          INSERT INTO formulas (
            code,
            name,
            finished_item_id,
            version_no,
            batch_size,
            batch_unit_id,
            notes,
            is_active
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, 1)
        `).run(
          sourceCode,

          data.name.trim(),

          Number(
            data.finishedItemId
          ),

          nextVersion,

          Number(
            data.batchSize
          ),

          Number(
            data.batchUnitId
          ),

          data.notes
            ?.trim() ||
            null
        );

      const formulaId =
        Number(
          result.lastInsertRowid
        );

      insertFormulaItems(
        formulaId,
        data.ingredients
      );

      return {
        formulaId,
        code:
          sourceCode,

        versionNo:
          nextVersion,

        sourceFormulaId:
          Number(
            sourceFormulaId
          ),
      };
    });

  return transaction();
}

export function deactivateFormula(
  id
) {
  const result =
    db.prepare(`
      UPDATE formulas
      SET
        is_active = 0,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      Number(id)
    );

  if (
    result.changes ===
    0
  ) {
    throw new Error(
      "Formula not found."
    );
  }
}

export function activateFormula(
  id
) {
  const transaction =
    db.transaction(() => {
      const formula =
        db.prepare(`
          SELECT *
          FROM formulas
          WHERE id = ?
        `).get(
          Number(id)
        );

      if (!formula) {
        throw new Error(
          "Formula not found."
        );
      }

      db.prepare(`
        UPDATE formulas
        SET
          is_active = 0,
          updated_at = CURRENT_TIMESTAMP
        WHERE code = ?
      `).run(
        formula.code
      );

      db.prepare(`
        UPDATE formulas
        SET
          is_active = 1,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(
        Number(id)
      );

      return {
        formulaId:
          Number(id),

        code:
          formula.code,

        versionNo:
          Number(
            formula.version_no
          ),
      };
    });

  return transaction();
}