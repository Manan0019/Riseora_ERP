import db from "../db/database.js";
import {
  addStockTransaction,
  getItemStock,
} from "./stockService.js";
import {
  addInventoryValue,
  removeInventoryValue,
} from "./costService.js";

function generateAdjustmentNumber() {
  const year = new Date().getFullYear();

  const lastEntry = db.prepare(`
    SELECT id
    FROM stock_adjustments
    ORDER BY id DESC
    LIMIT 1
  `).get();

  const nextNumber =
    (lastEntry?.id || 0) + 1;

  return `ADJ-${year}-${String(nextNumber).padStart(5, "0")}`;
}

export function createStockAdjustment(data) {
  const transaction = db.transaction(() => {
    const adjustmentNo =
      generateAdjustmentNumber();

    const result = db
      .prepare(
        `
      INSERT INTO stock_adjustments (
        adjustment_no,
        adjustment_date,
        adjustment_type,
        reason,
        notes
      )
      VALUES (?, ?, ?, ?, ?)
    `,
      )
      .run(
        adjustmentNo,
        data.adjustmentDate,
        data.adjustmentType,
        data.reason,
        data.notes || null,
      );

    const adjustmentId = Number(result.lastInsertRowid);

    const insertLine = db.prepare(`
      INSERT INTO stock_adjustment_items (
        stock_adjustment_id,
        item_id,
        quantity,
        unit_cost,
        lot_no,
        expiry_date
      )
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    for (const item of data.items) {
      let transactionUnitCost = unitCost;

      if (data.adjustmentType === "IN") {
        addInventoryValue(itemId, quantity, unitCost);
      } else {
        const costResult = removeInventoryValue(itemId, quantity);

        transactionUnitCost = costResult.unitCost;
      }

      addStockTransaction({
        transactionDate: data.adjustmentDate,

        itemId,

        transactionType:
          data.adjustmentType === "IN" ? "ADJUSTMENT_IN" : "ADJUSTMENT_OUT",

        referenceType: "STOCK_ADJUSTMENT",

        referenceId: adjustmentId,

        referenceNo: adjustmentNo,

        quantityIn: data.adjustmentType === "IN" ? quantity : 0,

        quantityOut: data.adjustmentType === "OUT" ? quantity : 0,

        unitCost: transactionUnitCost,

        lotNo: item.lotNo || null,

        expiryDate: item.expiryDate || null,

        notes: data.reason,
      });
    }

    return {
      adjustmentId,
      adjustmentNo,
    };
  });

  return transaction();
}