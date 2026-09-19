import db from "../db/database.js";

import {
  addStockTransaction,
  getItemStock,
} from "./stockService.js";

import {
  getFormulaById,
} from "./formulaService.js";

function generateBatchNumber() {
  const year = new Date().getFullYear();

  const lastBatch = db.prepare(`
    SELECT id
    FROM production_batches
    ORDER BY id DESC
    LIMIT 1
  `).get();

  const nextNumber =
    (lastBatch?.id || 0) + 1;

  return `BATCH-${year}-${String(nextNumber).padStart(5, "0")}`;
}

export function calculateProductionRequirements(
  formulaId,
  requiredBatchSize
) {
  const formula =
    getFormulaById(formulaId);

  if (!formula) {
    throw new Error(
      "Formula not found."
    );
  }

  const requiredSize =
    Number(requiredBatchSize);

  if (requiredSize <= 0) {
    throw new Error(
      "Required batch size must be greater than zero."
    );
  }

  const scaleFactor =
    requiredSize /
    Number(formula.batch_size);

  const ingredients =
    formula.ingredients.map(
      (ingredient) => {
        const requiredQuantity =
          Number(
            ingredient.quantity
          ) * scaleFactor;

        const currentStock =
          Number(
            getItemStock(
              ingredient.ingredient_item_id
            )
          );

        return {
          ingredientItemId:
            ingredient.ingredient_item_id,

          ingredientCode:
            ingredient.ingredient_code,

          ingredientName:
            ingredient.ingredient_name,

          unitId:
            ingredient.unit_id,

          unitCode:
            ingredient.unit_code,

          baseQuantity:
            Number(
              ingredient.quantity
            ),

          requiredQuantity,

          currentStock,

          sufficientStock:
            currentStock >=
            requiredQuantity,
        };
      }
    );

  return {
    formula,
    requiredBatchSize:
      requiredSize,
    scaleFactor,
    ingredients,
  };
}

export function createProductionBatch(
  data
) {
  const transaction = db.transaction(() => {
    const calculation =
      calculateProductionRequirements(
        Number(data.formulaId),
        Number(data.plannedBatchSize)
      );

    const formula =
      calculation.formula;

    for (
      const ingredient of
        calculation.ingredients
    ) {
      if (
        !ingredient.sufficientStock
      ) {
        throw new Error(
          `${ingredient.ingredientName}: insufficient stock. Required ${ingredient.requiredQuantity.toFixed(
            3
          )}, available ${ingredient.currentStock.toFixed(
            3
          )}.`
        );
      }
    }

    const actualOutputQty =
      Number(
        data.actualOutputQty
      );

    if (actualOutputQty <= 0) {
      throw new Error(
        "Actual output quantity must be greater than zero."
      );
    }

    const batchNo =
      generateBatchNumber();

    const batchResult =
      db.prepare(`
        INSERT INTO production_batches (
          batch_no,
          production_date,
          formula_id,
          planned_batch_size,
          actual_output_qty,
          batch_unit_id,
          finished_item_id,
          finished_lot_no,
          mfg_date,
          expiry_date,
          notes
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        batchNo,
        data.productionDate,
        Number(data.formulaId),
        Number(data.plannedBatchSize),
        actualOutputQty,
        Number(
          formula.batch_unit_id
        ),
        Number(
          formula.finished_item_id
        ),
        data.finishedLotNo ||
          null,
        data.mfgDate || null,
        data.expiryDate ||
          null,
        data.notes || null
      );

    const productionBatchId =
      Number(
        batchResult.lastInsertRowid
      );

    const insertConsumption =
      db.prepare(`
        INSERT INTO production_consumption (
          production_batch_id,
          item_id,
          planned_quantity,
          actual_quantity,
          unit_id,
          lot_no,
          unit_cost
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

    for (
      const ingredient of
        calculation.ingredients
    ) {
      const actualIngredient =
        data.ingredients?.find(
          (item) =>
            Number(
              item.itemId
            ) ===
            Number(
              ingredient.ingredientItemId
            )
        );

      const actualQuantity =
        actualIngredient
          ? Number(
              actualIngredient.actualQuantity
            )
          : ingredient.requiredQuantity;

      if (actualQuantity <= 0) {
        throw new Error(
          `${ingredient.ingredientName}: actual consumption must be greater than zero.`
        );
      }

      const currentStock =
        Number(
          getItemStock(
            ingredient.ingredientItemId
          )
        );

      if (
        actualQuantity >
        currentStock
      ) {
        throw new Error(
          `${ingredient.ingredientName}: actual consumption exceeds available stock.`
        );
      }

      const lotNo =
        actualIngredient?.lotNo ||
        null;

      const unitCost =
        Number(
          actualIngredient?.unitCost ||
            0
        );

      insertConsumption.run(
        productionBatchId,
        ingredient.ingredientItemId,
        ingredient.requiredQuantity,
        actualQuantity,
        ingredient.unitId,
        lotNo,
        unitCost
      );

      addStockTransaction({
        transactionDate:
          data.productionDate,

        itemId:
          ingredient.ingredientItemId,

        transactionType:
          "PRODUCTION_CONSUMPTION",

        referenceType:
          "PRODUCTION",

        referenceId:
          productionBatchId,

        referenceNo:
          batchNo,

        quantityIn: 0,

        quantityOut:
          actualQuantity,

        unitCost,

        lotNo,

        expiryDate: null,

        notes:
          `Consumed in ${batchNo}`,
      });
    }

    addStockTransaction({
      transactionDate:
        data.productionDate,

      itemId:
        formula.finished_item_id,

      transactionType:
        "PRODUCTION_OUTPUT",

      referenceType:
        "PRODUCTION",

      referenceId:
        productionBatchId,

      referenceNo:
        batchNo,

      quantityIn:
        actualOutputQty,

      quantityOut: 0,

      unitCost:
        Number(
          data.finishedUnitCost ||
            0
        ),

      lotNo:
        data.finishedLotNo ||
        null,

      expiryDate:
        data.expiryDate ||
        null,

      notes:
        `Produced in ${batchNo}`,
    });

    return {
      productionBatchId,
      batchNo,
    };
  });

  return transaction();
}

export function getProductionBatches() {
  return db.prepare(`
    SELECT
      pb.id,
      pb.batch_no,
      pb.production_date,
      pb.planned_batch_size,
      pb.actual_output_qty,
      pb.finished_lot_no,
      pb.mfg_date,
      pb.expiry_date,
      pb.status,
      pb.created_at,

      f.code AS formula_code,
      f.name AS formula_name,
      f.version_no,

      i.code AS finished_item_code,
      i.name AS finished_item_name,

      u.code AS batch_unit_code

    FROM production_batches pb

    INNER JOIN formulas f
      ON f.id = pb.formula_id

    INNER JOIN items i
      ON i.id = pb.finished_item_id

    INNER JOIN units u
      ON u.id = pb.batch_unit_id

    ORDER BY
      pb.production_date DESC,
      pb.id DESC
  `).all();
}

export function getProductionBatchById(id) {
  const batch = db.prepare(`
    SELECT
      pb.*,

      f.code AS formula_code,
      f.name AS formula_name,
      f.version_no,

      i.code AS finished_item_code,
      i.name AS finished_item_name,

      u.code AS batch_unit_code

    FROM production_batches pb

    INNER JOIN formulas f
      ON f.id = pb.formula_id

    INNER JOIN items i
      ON i.id = pb.finished_item_id

    INNER JOIN units u
      ON u.id = pb.batch_unit_id

    WHERE pb.id = ?
  `).get(id);

  if (!batch) {
    return null;
  }

  const consumption = db.prepare(`
    SELECT
      pc.id,
      pc.item_id,
      pc.planned_quantity,
      pc.actual_quantity,
      pc.unit_id,
      pc.lot_no,
      pc.unit_cost,

      i.code AS item_code,
      i.name AS item_name,

      u.code AS unit_code

    FROM production_consumption pc

    INNER JOIN items i
      ON i.id = pc.item_id

    INNER JOIN units u
      ON u.id = pc.unit_id

    WHERE pc.production_batch_id = ?

    ORDER BY pc.id
  `).all(id);

  return {
    ...batch,
    consumption,
  };
}

export function cancelProductionBatch(id) {
  const transaction = db.transaction(() => {
    const batch = db.prepare(`
      SELECT *
      FROM production_batches
      WHERE id = ?
    `).get(id);

    if (!batch) {
      throw new Error(
        "Production batch not found."
      );
    }

    if (
      batch.status === "CANCELLED"
    ) {
      throw new Error(
        "Production batch is already cancelled."
      );
    }

    const consumption =
      db.prepare(`
        SELECT *
        FROM production_consumption
        WHERE production_batch_id = ?
      `).all(id);

    const finishedStock =
      Number(
        getItemStock(
          batch.finished_item_id
        )
      );

    if (
      Number(
        batch.actual_output_qty
      ) >
      finishedStock
    ) {
      throw new Error(
        "Production batch cannot be cancelled because the produced finished stock is no longer fully available."
      );
    }

    for (
      const item of consumption
    ) {
      addStockTransaction({
        transactionDate:
          new Date()
            .toISOString()
            .slice(0, 10),

        itemId:
          item.item_id,

        transactionType:
          "PRODUCTION_CANCEL_CONSUMPTION",

        referenceType:
          "PRODUCTION",

        referenceId:
          batch.id,

        referenceNo:
          batch.batch_no,

        quantityIn:
          item.actual_quantity,

        quantityOut: 0,

        unitCost:
          item.unit_cost,

        lotNo:
          item.lot_no || null,

        expiryDate: null,

        notes:
          `Reversal of consumption for ${batch.batch_no}`,
      });
    }

    addStockTransaction({
      transactionDate:
        new Date()
          .toISOString()
          .slice(0, 10),

      itemId:
        batch.finished_item_id,

      transactionType:
        "PRODUCTION_CANCEL_OUTPUT",

      referenceType:
        "PRODUCTION",

      referenceId:
        batch.id,

      referenceNo:
        batch.batch_no,

      quantityIn: 0,

      quantityOut:
        batch.actual_output_qty,

      unitCost: 0,

      lotNo:
        batch.finished_lot_no || null,

      expiryDate:
        batch.expiry_date || null,

      notes:
        `Reversal of output for ${batch.batch_no}`,
    });

    db.prepare(`
      UPDATE production_batches
      SET
        status = 'CANCELLED',
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(id);

    return {
      id:
        batch.id,

      batchNo:
        batch.batch_no,

      status:
        "CANCELLED",
    };
  });

  return transaction();
}