import db from "../db/database.js";

import {
  addStockTransaction,
  getItemStock,
} from "./stockService.js";

import {
  getFormulaById,
} from "./formulaService.js";

import {
  addInventoryValue,
  removeInventoryValue,
  reverseInventoryReceipt,
} from "./costService.js";

import {
  convertQuantity,
  convertQuantityByUnitIds,
  getItemBaseUnit,
  getUnitById,
} from "./unitConversionService.js";

function generateBatchNumber() {
  const year =
    new Date().getFullYear();

  const lastBatch =
    db.prepare(`
      SELECT id
      FROM production_batches
      ORDER BY id DESC
      LIMIT 1
    `).get();

  const nextNumber =
    (lastBatch?.id || 0) + 1;

  return `BATCH-${year}-${String(
    nextNumber
  ).padStart(5, "0")}`;
}

export function calculateProductionRequirements(
  formulaId,
  requiredBatchSize
) {
  const formula =
    getFormulaById(
      formulaId
    );

  if (!formula) {
    throw new Error(
      "Formula not found."
    );
  }

  if (Number(formula.is_active) !== 1) {
    throw new Error(
      "Inactive formula versions cannot be used for production."
    );
  }

  const requiredSize =
    Number(
      requiredBatchSize
    );

  if (
    !Number.isFinite(requiredSize) ||
    requiredSize <= 0
  ) {
    throw new Error(
      "Required batch size must be greater than zero."
    );
  }

  const formulaBatchSize =
    Number(
      formula.batch_size
    );

  if (
    formulaBatchSize <= 0
  ) {
    throw new Error(
      "Formula base batch size must be greater than zero."
    );
  }

  const scaleFactor =
    requiredSize /
    formulaBatchSize;

  const ingredients =
    formula.ingredients.map(
      (ingredient) => {
        /*
         * Quantity in the unit saved
         * on the formula.
         *
         * Example:
         * 500 ML
         */
        const requiredQuantity =
          Number(
            ingredient.quantity
          ) *
          scaleFactor;

        /*
         * Item stock is always maintained
         * in the item's base unit.
         *
         * Example:
         * Sesame Oil base unit = L
         */
        const itemBaseUnit =
          getItemBaseUnit(
            ingredient
              .ingredient_item_id
          );

        /*
         * Convert formula requirement
         * into stock/base unit.
         *
         * Example:
         * 500 ML -> 0.500 L
         */
        const requiredBaseQuantity =
          convertQuantityByUnitIds(
            requiredQuantity,
            ingredient.unit_id,
            itemBaseUnit.unitId
          );

        /*
         * Current stock from stock ledger
         * is already in item base unit.
         */
        const currentStockBase =
          Number(
            getItemStock(
              ingredient
                .ingredient_item_id
            )
          );

        /*
         * Convert stock back to formula
         * unit only for user-friendly
         * display.
         *
         * Example:
         * 5 L -> 5000 ML
         */
        const currentStock =
          convertQuantityByUnitIds(
            currentStockBase,
            itemBaseUnit.unitId,
            ingredient.unit_id
          );

        return {
          ingredientItemId:
            ingredient
              .ingredient_item_id,

          ingredientCode:
            ingredient
              .ingredient_code,

          ingredientName:
            ingredient
              .ingredient_name,

          /*
           * Formula/display unit.
           */
          unitId:
            ingredient.unit_id,

          unitCode:
            ingredient.unit_code,

          /*
           * Item stock/base unit.
           */
          baseUnitId:
            itemBaseUnit.unitId,

          baseUnitCode:
            itemBaseUnit.unitCode,

          baseQuantity:
            Number(
              ingredient.quantity
            ),

          /*
           * Requirement shown to user
           * in formula unit.
           */
          requiredQuantity,

          /*
           * Quantity actually used for
           * stock/cost calculations.
           */
          requiredBaseQuantity,

          /*
           * User-friendly stock display
           * in formula unit.
           */
          currentStock,

          /*
           * Actual stock quantity in
           * item's base unit.
           */
          currentStockBase,

          sufficientStock:
            currentStockBase >=
            requiredBaseQuantity,
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
  const transaction =
    db.transaction(() => {
      const calculation =
        calculateProductionRequirements(
          Number(
            data.formulaId
          ),
          Number(
            data.plannedBatchSize
          )
        );

      const formula =
        calculation.formula;

      /*
       * Validate stock using quantities
       * converted into item base units.
       */
      for (
        const ingredient of
          calculation.ingredients
      ) {
        if (
          !ingredient
            .sufficientStock
        ) {
          throw new Error(
            `${ingredient.ingredientName}: insufficient stock. Required ${ingredient.requiredQuantity.toFixed(
              3
            )} ${ingredient.unitCode}, available ${ingredient.currentStock.toFixed(
              3
            )} ${ingredient.unitCode}.`
          );
        }
      }

      /*
       * Actual output is entered in the
       * formula batch unit.
       */
      const actualOutputQty =
        Number(
          data.actualOutputQty
        );

      if (
        !Number.isFinite(actualOutputQty) ||
        actualOutputQty <= 0
      ) {
        throw new Error(
          "Actual output quantity must be greater than zero."
        );
      }

      /*
       * Finished item stock must also
       * be stored in its own base unit.
       */
      const finishedBaseUnit =
        getItemBaseUnit(
          formula
            .finished_item_id
        );

      /*
       * Convert actual output from formula
       * batch unit to finished item base unit.
       *
       * Example:
       * Formula output = 5000 ML
       * Finished base unit = L
       * Result = 5 L
       *
       * For packaged FG:
       * PCS -> PCS
       */
      const actualOutputBaseQty =
        convertQuantityByUnitIds(
          actualOutputQty,
          formula.batch_unit_id,
          finishedBaseUnit.unitId
        );

      if (
        actualOutputBaseQty <= 0
      ) {
        throw new Error(
          "Converted finished output quantity must be greater than zero."
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

          Number(
            data.formulaId
          ),

          Number(
            data.plannedBatchSize
          ),

          /*
           * Keep original entered output
           * for production history/display.
           */
          actualOutputQty,

          Number(
            formula.batch_unit_id
          ),

          Number(
            formula.finished_item_id
          ),

          data.finishedLotNo ||
            null,

          data.mfgDate ||
            null,

          data.expiryDate ||
            null,

          data.notes ||
            null
        );

      const productionBatchId =
        Number(
          batchResult
            .lastInsertRowid
        );

      let materialCost = 0;

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

      for (const ingredient of calculation.ingredients) {
        const actualIngredient = data.ingredients?.find(
          (item) => Number(item.itemId) === Number(ingredient.ingredientItemId),
        );

        /*
         * Actual quantity entered by user
         * is in formula ingredient unit.
         *
         * Example:
         * user enters 480 ML.
         */
        const actualQuantity = actualIngredient
          ? Number(actualIngredient.actualQuantity)
          : ingredient.requiredQuantity;

        if (!Number.isFinite(actualQuantity) || actualQuantity <= 0) {
          throw new Error(
            `${ingredient.ingredientName}: actual consumption must be greater than zero.`,
          );
        }

        /*
         * Convert actual entered quantity
         * to stock/base unit.
         *
         * Example:
         * 480 ML -> 0.480 L
         */
        const actualBaseQuantity = convertQuantityByUnitIds(
          actualQuantity,
          ingredient.unitId,
          ingredient.baseUnitId,
        );

        const currentStockBase = Number(
          getItemStock(ingredient.ingredientItemId),
        );

        if (actualBaseQuantity > currentStockBase) {
          const availableInFormulaUnit = convertQuantityByUnitIds(
            currentStockBase,
            ingredient.baseUnitId,
            ingredient.unitId,
          );

          throw new Error(
            `${ingredient.ingredientName}: actual consumption exceeds available stock. Available ${availableInFormulaUnit.toFixed(
              3,
            )} ${ingredient.unitCode}.`,
          );
        }

        const lotNo = actualIngredient?.lotNo || null;

        /*
         * COSTING MUST use base-unit
         * quantity because inventory cost
         * state is maintained in base units.
         */
        const costResult = removeInventoryValue(
          ingredient.ingredientItemId,

          actualBaseQuantity,
        );

        /*
         * costResult.unitCost is therefore
         * cost per ITEM BASE UNIT.
         *
         * Example:
         * ₹400 per L.
         */
        const baseUnitCost = costResult.unitCost;

        materialCost += Number(costResult.valueRemoved || 0);

        /*
         * Keep production history in the
         * unit the formula/user used.
         *
         * But unit_cost stored here should
         * match that same stored unit.
         *
         * Example:
         * Base cost = ₹400/L
         * Formula unit = ML
         * Formula unit cost = ₹0.40/ML
         */
        const formulaUnit = getUnitById(ingredient.unitId);

        const baseUnit = getUnitById(ingredient.baseUnitId);

        /*
         * Convert "1 formula unit" into
         * base-unit quantity.
         *
         * Example:
         * 1 ML = 0.001 L.
         */
        const oneFormulaUnitInBase = convertQuantity(
          1,
          formulaUnit.code,
          baseUnit.code,
        );

        const formulaUnitCost = baseUnitCost * oneFormulaUnitInBase;

        insertConsumption.run(
          productionBatchId,

          ingredient.ingredientItemId,

          /*
           * Stored in formula unit.
           */
          ingredient.requiredQuantity,

          /*
           * Stored in formula unit.
           */
          actualQuantity,

          ingredient.unitId,

          lotNo,

          /*
           * Cost matching formula unit.
           */
          formulaUnitCost,
        );

        /*
         * STOCK TRANSACTIONS always use
         * item base quantity and base
         * unit cost.
         */
        addStockTransaction({
          transactionDate: data.productionDate,

          itemId: ingredient.ingredientItemId,

          transactionType: "PRODUCTION_CONSUMPTION",

          referenceType: "PRODUCTION",

          referenceId: productionBatchId,

          referenceNo: batchNo,

          quantityIn: 0,

          quantityOut: actualBaseQuantity,

          unitCost: baseUnitCost,

          lotNo,

          expiryDate: null,

          notes: `Consumed in ${batchNo}`,
        });
      }

      const labourCost = Number(data.labourCost || 0);

      const electricityCost = Number(data.electricityCost || 0);

      const otherOverheadCost = Number(data.otherOverheadCost || 0);

      if (
        !Number.isFinite(labourCost) ||
        !Number.isFinite(electricityCost) ||
        !Number.isFinite(otherOverheadCost) ||
        labourCost < 0 ||
        electricityCost < 0 ||
        otherOverheadCost < 0
      ) {
        throw new Error("Production overhead costs must be valid non-negative numbers.");
      }

      const totalOverheadCost =
        labourCost + electricityCost + otherOverheadCost;

      const totalProductionCost = materialCost + totalOverheadCost;

      /*
       * Finished product inventory cost
       * must be cost PER FINISHED BASE UNIT.
       *
       * Example:
       *
       * total production cost = ₹2500
       * finished stock = 50 PCS
       *
       * ₹2500 / 50 = ₹50/PCS
       */
      const finishedUnitCost =
        actualOutputBaseQty > 0
          ? totalProductionCost /
            actualOutputBaseQty
          : 0;

db.prepare(
  `
  UPDATE production_batches
  SET
    material_cost = ?,
    labour_cost = ?,
    electricity_cost = ?,
    other_overhead_cost = ?,
    total_production_cost = ?,
    finished_unit_cost = ?,
    updated_at = CURRENT_TIMESTAMP
  WHERE id = ?
`,
).run(
  materialCost,
  labourCost,
  electricityCost,
  otherOverheadCost,
  totalProductionCost,
  finishedUnitCost,
  productionBatchId,
);

      /*
       * Add finished stock using
       * FINISHED ITEM BASE UNIT.
       */
      addInventoryValue(
        formula
          .finished_item_id,

        actualOutputBaseQty,

        finishedUnitCost
      );

      addStockTransaction({
        transactionDate:
          data.productionDate,

        itemId:
          formula
            .finished_item_id,

        transactionType:
          "PRODUCTION_OUTPUT",

        referenceType:
          "PRODUCTION",

        referenceId:
          productionBatchId,

        referenceNo:
          batchNo,

        quantityIn:
          actualOutputBaseQty,

        quantityOut: 0,

        unitCost:
          finishedUnitCost,

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

        materialCost,
        labourCost,
        electricityCost,
        otherOverheadCost,
        totalOverheadCost,

        totalProductionCost,
        finishedUnitCost,

        actualOutputQty,

        actualOutputUnit: getUnitById(formula.batch_unit_id).code,

        actualOutputBaseQty,

        finishedBaseUnit: finishedBaseUnit.unitCode,
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
      ON f.id =
         pb.formula_id

    INNER JOIN items i
      ON i.id =
         pb.finished_item_id

    INNER JOIN units u
      ON u.id =
         pb.batch_unit_id

    ORDER BY
      pb.production_date DESC,
      pb.id DESC
  `).all();
}

export function getProductionBatchById(
  id
) {
  const batch =
    db.prepare(`
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
        ON f.id =
           pb.formula_id

      INNER JOIN items i
        ON i.id =
           pb.finished_item_id

      INNER JOIN units u
        ON u.id =
           pb.batch_unit_id

      WHERE pb.id = ?
    `).get(id);

  if (!batch) {
    return null;
  }

  const consumption = db
    .prepare(
      `
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

        c.code AS category_code,
        c.name AS category_name,

        u.code AS unit_code

      FROM production_consumption pc

      INNER JOIN items i
        ON i.id = pc.item_id

      INNER JOIN item_categories c
        ON c.id = i.category_id

      INNER JOIN units u
        ON u.id = pc.unit_id

      WHERE
        pc.production_batch_id = ?

      ORDER BY
        pc.id
    `,
    )
    .all(id);

  return {
    ...batch,
    consumption,
  };
}

export function cancelProductionBatch(
  id
) {
  const transaction =
    db.transaction(() => {
      const batch =
        db.prepare(`
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
        batch.status ===
        "CANCELLED"
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

      /*
       * Convert stored production output
       * back into finished-item base unit.
       */
      const finishedBaseUnit =
        getItemBaseUnit(
          batch
            .finished_item_id
        );

      const finishedOutputBaseQty =
        convertQuantityByUnitIds(
          Number(
            batch
              .actual_output_qty
          ),

          Number(
            batch
              .batch_unit_id
          ),

          finishedBaseUnit.unitId
        );

      const finishedStock =
        Number(
          getItemStock(
            batch
              .finished_item_id
          )
        );

      if (
        finishedOutputBaseQty >
        finishedStock
      ) {
        throw new Error(
          "Production batch cannot be cancelled because the produced finished stock is no longer fully available."
        );
      }

      /*
       * Remove finished goods from the
       * current weighted-average inventory.
       */
      const originalOutput = db.prepare(`
        SELECT id, unit_cost
        FROM stock_transactions
        WHERE reference_type = 'PRODUCTION'
          AND reference_id = ?
          AND item_id = ?
          AND transaction_type = 'PRODUCTION_OUTPUT'
        ORDER BY id
        LIMIT 1
      `).get(batch.id, batch.finished_item_id);

      if (!originalOutput) {
        throw new Error(
          "Original production output costing transaction was not found.",
        );
      }

      const laterFinishedOutgoing = db.prepare(`
        SELECT id, transaction_type, reference_no
        FROM stock_transactions
        WHERE item_id = ?
          AND id > ?
          AND quantity_out > 0
        ORDER BY id
        LIMIT 1
      `).get(batch.finished_item_id, originalOutput.id);

      if (laterFinishedOutgoing) {
        throw new Error(
          "Production batch cannot be cancelled because the produced item has subsequent stock usage. Use a stock adjustment/return workflow instead.",
        );
      }

      const finishedCostResult =
        reverseInventoryReceipt(
          batch.finished_item_id,
          finishedOutputBaseQty,
          Number(originalOutput.unit_cost || 0)
        );

      /*
       * Restore every consumed component.
       */
      for (
        const item of
          consumption
      ) {
        const itemBaseUnit =
          getItemBaseUnit(
            item.item_id
          );

        /*
         * Consumption quantity is stored
         * in production/formula unit.
         *
         * Convert it back to item base unit.
         */
        const restoredBaseQuantity =
          convertQuantityByUnitIds(
            Number(
              item.actual_quantity
            ),

            Number(
              item.unit_id
            ),

            itemBaseUnit.unitId
          );

        /*
         * unit_cost in production_consumption
         * is stored per formula unit.
         *
         * Convert it to value, then derive
         * cost per base unit.
         */
        const restoredTotalValue =
          Number(
            item.actual_quantity
          ) *
          Number(
            item.unit_cost ||
              0
          );

        const restoredBaseUnitCost =
          restoredBaseQuantity > 0
            ? restoredTotalValue /
              restoredBaseQuantity
            : 0;

        addInventoryValue(
          item.item_id,

          restoredBaseQuantity,

          restoredBaseUnitCost
        );

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
            restoredBaseQuantity,

          quantityOut: 0,

          unitCost:
            restoredBaseUnitCost,

          lotNo:
            item.lot_no ||
            null,

          expiryDate:
            null,

          notes:
            `Reversal of consumption for ${batch.batch_no}`,
        });
      }

      /*
       * Reverse finished goods stock.
       */
      addStockTransaction({
        transactionDate:
          new Date()
            .toISOString()
            .slice(0, 10),

        itemId:
          batch
            .finished_item_id,

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
          finishedOutputBaseQty,

        unitCost:
          finishedCostResult
            .unitCost,

        lotNo:
          batch
            .finished_lot_no ||
          null,

        expiryDate:
          batch
            .expiry_date ||
          null,

        notes:
          `Reversal of output for ${batch.batch_no}`,
      });

      db.prepare(`
        UPDATE production_batches
        SET
          status = 'CANCELLED',
          updated_at =
            CURRENT_TIMESTAMP
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