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
  const itemId = Number(item.itemId);
  const quantity = Number(item.quantity);
  const enteredUnitCost = Number(item.unitCost || 0);

  if (!Number.isInteger(itemId) || itemId <= 0) {
    throw new Error("Item is required.");
  }

  const masterItem = db.prepare(`
    SELECT id, name, is_active, track_lot, track_expiry
    FROM items
    WHERE id = ?
  `).get(itemId);

  if (!masterItem) {
    throw new Error("Selected item was not found.");
  }
  if (Number(masterItem.is_active) !== 1) {
    throw new Error(`${masterItem.name}: inactive items cannot be adjusted.`);
  }

  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new Error("Adjustment quantity must be greater than zero.");
  }

  const lotNo = String(item.lotNo || "").trim();
  const expiryDate = String(item.expiryDate || "").trim();

  if (data.adjustmentType === "IN") {
    if (Number(masterItem.track_lot) === 1 && !lotNo) {
      throw new Error(`${masterItem.name}: lot/batch number is required for stock adjustment IN.`);
    }
    if (Number(masterItem.track_expiry) === 1 && !expiryDate) {
      throw new Error(`${masterItem.name}: expiry date is required for stock adjustment IN.`);
    }
  }

  let transactionUnitCost = 0;

  if (
    data.adjustmentType ===
    "IN"
  ) {
    if (
      !Number.isFinite(
        enteredUnitCost
      ) ||
      enteredUnitCost < 0
    ) {
      throw new Error(
        "Adjustment IN unit cost cannot be negative."
      );
    }

    transactionUnitCost =
      enteredUnitCost;

    addInventoryValue(
      itemId,
      quantity,
      transactionUnitCost
    );
  } else if (
    data.adjustmentType ===
    "OUT"
  ) {
    const currentStock =
      Number(
        getItemStock(
          itemId
        )
      );

    if (
      quantity >
      currentStock
    ) {
      throw new Error(
        `Adjustment quantity exceeds available stock. Available stock: ${currentStock.toFixed(
          3
        )}.`
      );
    }

    const costResult =
      removeInventoryValue(
        itemId,
        quantity
      );

    transactionUnitCost =
      Number(
        costResult.unitCost ||
          0
      );
  } else {
    throw new Error(
      "Adjustment type must be IN or OUT."
    );
  }

  /*
   * Save the ACTUAL costing rate used.
   *
   * IN  = user-entered cost
   * OUT = weighted-average inventory cost
   */
  insertLine.run(
    adjustmentId,
    itemId,
    quantity,
    transactionUnitCost,
    lotNo ||
      null,
    expiryDate ||
      null
  );

  addStockTransaction({
    transactionDate:
      data.adjustmentDate,

    itemId,

    transactionType:
      data.adjustmentType ===
      "IN"
        ? "ADJUSTMENT_IN"
        : "ADJUSTMENT_OUT",

    referenceType:
      "STOCK_ADJUSTMENT",

    referenceId:
      adjustmentId,

    referenceNo:
      adjustmentNo,

    quantityIn:
      data.adjustmentType ===
      "IN"
        ? quantity
        : 0,

    quantityOut:
      data.adjustmentType ===
      "OUT"
        ? quantity
        : 0,

    unitCost:
      transactionUnitCost,

    lotNo:
      lotNo ||
      null,

    expiryDate:
      expiryDate ||
      null,

    notes:
      data.reason,
  });
}

    return {
      adjustmentId,
      adjustmentNo,
    };
  });

  return transaction();
}