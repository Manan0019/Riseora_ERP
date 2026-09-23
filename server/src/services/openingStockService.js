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

    for (let index = 0; index < data.items.length; index++) {
      const item = data.items[index];
      const itemId = Number(item.itemId);
      const quantity = Number(item.quantity);
      const unitCost = Number(item.unitCost || 0);

      const masterItem = db.prepare(`
        SELECT id, name, is_active, track_lot, track_expiry
        FROM items
        WHERE id = ?
      `).get(itemId);

      if (!masterItem) {
        throw new Error(`Item not found in row ${index + 1}.`);
      }
      if (Number(masterItem.is_active) !== 1) {
        throw new Error(`${masterItem.name}: inactive items cannot receive opening stock.`);
      }
      if (!Number.isFinite(quantity) || quantity <= 0) {
        throw new Error(`${masterItem.name}: opening stock quantity must be greater than zero.`);
      }
      if (!Number.isFinite(unitCost) || unitCost < 0) {
        throw new Error(`${masterItem.name}: opening stock unit cost cannot be negative.`);
      }

      const lotNo = String(item.lotNo || "").trim();
      const expiryDate = String(item.expiryDate || "").trim();
      if (Number(masterItem.track_lot) === 1 && !lotNo) {
        throw new Error(`${masterItem.name}: lot/batch number is required.`);
      }
      if (Number(masterItem.track_expiry) === 1 && !expiryDate) {
        throw new Error(`${masterItem.name}: expiry date is required.`);
      }

      insertLine.run(
        openingStockId,
        itemId,
        quantity,
        unitCost,
        lotNo || null,
        expiryDate || null,
      );

      addInventoryValue(itemId, quantity, unitCost);

      addStockTransaction({
        transactionDate: data.openingDate,
        itemId,
        transactionType: "OPENING_STOCK",
        referenceType: "OPENING_STOCK",
        referenceId: openingStockId,
        referenceNo: openingNo,
        quantityIn: quantity,
        quantityOut: 0,
        unitCost,
        lotNo: lotNo || null,
        expiryDate: expiryDate || null,
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
