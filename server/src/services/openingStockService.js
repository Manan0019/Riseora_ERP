import db from "../db/database.js";
import { addStockTransaction } from "./stockService.js";
import { addInventoryValue } from "./costService.js";

function generateOpeningNumber() {
  const year = new Date().getFullYear();

  const lastEntry = db
    .prepare(
      `
    SELECT id
    FROM opening_stock_entries
    ORDER BY id DESC
    LIMIT 1
  `,
    )
    .get();

  const nextNumber = (lastEntry?.id || 0) + 1;

  return `OPEN-${year}-${String(nextNumber).padStart(5, "0")}`;
}

export function createOpeningStock(data) {
  const transaction = db.transaction(() => {
    const openingNo = generateOpeningNumber();

    const result = db
      .prepare(
        `
      INSERT INTO opening_stock_entries (
        opening_no,
        opening_date,
        notes
      )
      VALUES (?, ?, ?)
    `,
      )
      .run(openingNo, data.openingDate, data.notes || null);

    const openingStockId = Number(result.lastInsertRowid);

    const insertLine = db.prepare(`
      INSERT INTO opening_stock_items (
        opening_stock_id,
        item_id,
        quantity,
        unit_cost,
        lot_no,
        expiry_date
      )
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    for (const item of data.items) {
      const quantity = Number(item.quantity);

      const unitCost = Number(item.unitCost || 0);

      if (!Number.isFinite(quantity) || quantity <= 0) {
        throw new Error("Opening stock quantity must be greater than zero.");
      }

      if (!Number.isFinite(unitCost) || unitCost < 0) {
        throw new Error("Opening stock unit cost cannot be negative.");
      }

      insertLine.run(
        openingStockId,
        Number(item.itemId),
        quantity,
        unitCost,
        item.lotNo || null,
        item.expiryDate || null,
      );

      addInventoryValue(Number(item.itemId), quantity, unitCost);

      addStockTransaction({
        transactionDate: data.openingDate,

        itemId: Number(item.itemId),

        transactionType: "OPENING_STOCK",

        referenceType: "OPENING_STOCK",

        referenceId: openingStockId,

        referenceNo: openingNo,

        quantityIn: quantity,

        quantityOut: 0,

        unitCost: unitCost,

        lotNo: item.lotNo || null,

        expiryDate: item.expiryDate || null,

        notes: `Opening stock ${openingNo}`,
      });
    }

    return {
      openingStockId,
      openingNo,
    };
  });

  return transaction();
}
