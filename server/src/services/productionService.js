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