import db from "../db/database.js";

import {
  addStockTransaction,
} from "./stockService.js";

import {
  addInventoryValue,
  reverseInventoryReceipt,
} from "./costService.js";

function addDaysToDate(dateText, days) {
  const date = new Date(`${dateText}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) {
    throw new Error("A valid purchase date is required.");
  }
  date.setUTCDate(date.getUTCDate() + Number(days || 0));
  return date.toISOString().slice(0, 10);
}

function generatePurchaseNumber() {
  const year =
    new Date().getFullYear();

  const lastPurchase =
    db.prepare(`
      SELECT id
      FROM purchases
      ORDER BY id DESC
      LIMIT 1
    `).get();

  const nextNumber =
    (lastPurchase?.id || 0) + 1;

  return `PUR-${year}-${String(
    nextNumber
  ).padStart(5, "0")}`;
}

export function createPurchase(data) {
  const transaction =
    db.transaction(() => {
      if (!Array.isArray(data.items) || data.items.length === 0) {
        throw new Error("At least one purchase item is required.");
      }

      const supplier = db.prepare(`
        SELECT id, code, name, is_active, payment_terms_days
        FROM suppliers
        WHERE id = ?
      `).get(Number(data.supplierId));

      if (!supplier) throw new Error("Please select a valid supplier.");
      if (Number(supplier.is_active) !== 1) {
        throw new Error("Inactive suppliers cannot be used on a new purchase.");
      }

      const supplierInvoiceNo = String(data.supplierInvoiceNo || "").trim();
      if (supplierInvoiceNo) {
        const duplicateInvoice = db.prepare(`
          SELECT purchase_no
          FROM purchases
          WHERE supplier_id = ?
            AND status = 'POSTED'
            AND UPPER(TRIM(COALESCE(supplier_invoice_no, ''))) = UPPER(?)
          LIMIT 1
        `).get(Number(data.supplierId), supplierInvoiceNo);

        if (duplicateInvoice) {
          throw new Error(`Supplier invoice ${supplierInvoiceNo} is already recorded as ${duplicateInvoice.purchase_no}.`);
        }
      }

      const purchaseNo =
        generatePurchaseNumber();

      let subtotal = 0;
      let gstAmount = 0;

      const calculatedItems =
        data.items.map((item, index) => {
          const quantity =
            Number(
              item.quantity
            );

          const rate =
            Number(
              item.rate
            );

          const gstRate =
            Number(
              item.gstRate || 0
            );

          const itemId = Number(item.itemId);
          if (!Number.isInteger(itemId) || itemId <= 0) {
            throw new Error(`Please select a valid item in row ${index + 1}.`);
          }

          if (!Number.isFinite(quantity) || quantity <= 0) {
            throw new Error(`Purchase quantity must be greater than zero in row ${index + 1}.`);
          }

          if (!Number.isFinite(rate) || rate < 0) {
            throw new Error(`Purchase rate cannot be negative in row ${index + 1}.`);
          }

          if (!Number.isFinite(gstRate) || gstRate < 0 || gstRate > 100) {
            throw new Error(`GST rate must be between 0 and 100 percent in row ${index + 1}.`);
          }

          const masterItem = db.prepare(`
            SELECT id, code, name, is_active, track_lot, track_expiry
            FROM items
            WHERE id = ?
          `).get(itemId);

          if (!masterItem) throw new Error(`Item not found in row ${index + 1}.`);
          if (Number(masterItem.is_active) !== 1) {
            throw new Error(`${masterItem.name}: inactive items cannot be purchased.`);
          }

          const lotNo = String(item.lotNo || "").trim();
          const expiryDate = String(item.expiryDate || "").trim();
          const mfgDate = String(item.mfgDate || "").trim();
          if (Number(masterItem.track_lot) === 1 && !lotNo) {
            throw new Error(`${masterItem.name}: lot/batch number is required.`);
          }
          if (Number(masterItem.track_expiry) === 1 && !expiryDate) {
            throw new Error(`${masterItem.name}: expiry date is required.`);
          }
          if (mfgDate && expiryDate && expiryDate < mfgDate) {
            throw new Error(`${masterItem.name}: expiry date cannot be earlier than manufacturing date.`);
          }

          const taxableAmount =
            quantity * rate;

          const lineGst =
            taxableAmount *
            (gstRate / 100);

          const lineTotal =
            taxableAmount +
            lineGst;

          subtotal +=
            taxableAmount;

          gstAmount +=
            lineGst;

          return {
            ...item,

            itemId,

            quantity,
            rate,
            gstRate,
            taxableAmount,

            gstAmount:
              lineGst,

            lineTotal,

            lotNo:
              lotNo ||
              null,

            mfgDate:
              mfgDate ||
              null,

            expiryDate:
              expiryDate ||
              null,
          };
        });

      const freightAmount =
        Number(
          data.freightAmount ||
            0
        );

      const otherCharges =
        Number(
          data.otherCharges ||
            0
        );

      if (
        !Number.isFinite(freightAmount) ||
        !Number.isFinite(otherCharges) ||
        freightAmount < 0 ||
        otherCharges < 0
      ) {
        throw new Error("Freight and other charges must be valid non-negative amounts.");
      }

      const landedCharges = freightAmount + otherCharges;

      for (const item of calculatedItems) {
        const share = subtotal > 0
          ? landedCharges * (item.taxableAmount / subtotal)
          : 0;

        item.inventoryUnitCost =
          item.quantity > 0
            ? (item.taxableAmount + share) / item.quantity
            : item.rate;
      }

      const grandTotal =
        subtotal +
        gstAmount +
        freightAmount +
        otherCharges;

      const purchaseResult =
        db.prepare(`
          INSERT INTO purchases (
            purchase_no,
            purchase_date,
            supplier_id,
            supplier_invoice_no,
            supplier_invoice_date,
            subtotal,
            gst_amount,
            freight_amount,
            other_charges,
            grand_total,
            notes
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          purchaseNo,
          data.purchaseDate,
          Number(
            data.supplierId
          ),
          supplierInvoiceNo ||
            null,
          data.supplierInvoiceDate ||
            null,
          subtotal,
          gstAmount,
          freightAmount,
          otherCharges,
          grandTotal,
          data.notes || null
        );

      const purchaseId =
        Number(
          purchaseResult
            .lastInsertRowid
        );

      const paymentTermsDaysSnapshot = Number(supplier.payment_terms_days || 0);
      const dueDate = addDaysToDate(data.purchaseDate, paymentTermsDaysSnapshot);
      db.prepare(`
        UPDATE purchases
        SET payment_terms_days_snapshot = ?, due_date = ?
        WHERE id = ?
      `).run(paymentTermsDaysSnapshot, dueDate, purchaseId);

      const insertItem =
        db.prepare(`
          INSERT INTO purchase_items (
            purchase_id,
            item_id,
            quantity,
            rate,
            taxable_amount,
            gst_rate,
            gst_amount,
            line_total,
            lot_no,
            mfg_date,
            expiry_date
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

      for (
        const item of
          calculatedItems
      ) {
        insertItem.run(
          purchaseId,
          item.itemId,
          item.quantity,
          item.rate,
          item.taxableAmount,
          item.gstRate,
          item.gstAmount,
          item.lineTotal,
          item.lotNo,
          item.mfgDate,
          item.expiryDate
        );

        /*
         * COSTING
         *
         * Purchase adds inventory using
         * the purchase rate.
         *
         * Weighted average is recalculated
         * inside addInventoryValue().
         */
        addInventoryValue(
          item.itemId,
          item.quantity,
          item.inventoryUnitCost
        );

        /*
         * STOCK LEDGER
         */
        addStockTransaction({
          transactionDate:
            data.purchaseDate,

          itemId:
            item.itemId,

          transactionType:
            "PURCHASE",

          referenceType:
            "PURCHASE",

          referenceId:
            purchaseId,

          referenceNo:
            purchaseNo,

          quantityIn:
            item.quantity,

          quantityOut: 0,

          unitCost:
            item.inventoryUnitCost,

          lotNo:
            item.lotNo,

          expiryDate:
            item.expiryDate,

          notes:
            `Purchase ${purchaseNo}`,
        });
      }

      return {
        purchaseId,
        purchaseNo,
        subtotal,
        gstAmount,
        freightAmount,
        otherCharges,
        grandTotal,
        paymentTermsDaysSnapshot,
        dueDate,
      };
    });

  return transaction();
}

export function getPurchases() {
  return db.prepare(`
    SELECT
      p.id,
      p.purchase_no,
      p.purchase_date,
      p.due_date,
      p.payment_terms_days_snapshot,
      p.supplier_invoice_no,
      p.supplier_invoice_date,

      p.subtotal,
      p.gst_amount,
      p.freight_amount,
      p.other_charges,
      p.grand_total,

      p.amount_paid,
      p.payment_status,

      p.status,

      s.code AS supplier_code,
      s.name AS supplier_name

    FROM purchases p

    INNER JOIN suppliers s
      ON s.id = p.supplier_id

    ORDER BY
      p.purchase_date DESC,
      p.id DESC
  `).all();
}

export function getPurchaseById(id) {
  const purchase =
    db.prepare(`
      SELECT
        p.*,

        s.code AS supplier_code,
        s.name AS supplier_name

      FROM purchases p

      INNER JOIN suppliers s
        ON s.id = p.supplier_id

      WHERE p.id = ?
    `).get(id);

  if (!purchase) {
    return null;
  }

  const items =
    db.prepare(`
      SELECT
        pi.*,

        i.code AS item_code,
        i.name AS item_name,

        u.code AS unit_code

      FROM purchase_items pi

      INNER JOIN items i
        ON i.id = pi.item_id

      INNER JOIN units u
        ON u.id = i.base_unit_id

      WHERE
        pi.purchase_id = ?

      ORDER BY
        pi.id
    `).all(id);

  return {
    ...purchase,
    items,
  };
}

export function cancelPurchase(id) {
  const transaction =
    db.transaction(() => {
      const purchase =
        db.prepare(`
          SELECT *
          FROM purchases
          WHERE id = ?
        `).get(id);

      if (!purchase) {
        throw new Error(
          "Purchase not found."
        );
      }

      if (
        purchase.status ===
        "CANCELLED"
      ) {
        throw new Error(
          "Purchase is already cancelled."
        );
      }

      /*
       * Payment safety.
       *
       * A paid purchase should not simply
       * disappear because supplier payment
       * history would become incorrect.
       */
      if (
        Number(
          purchase.amount_paid || 0
        ) > 0
      ) {
        throw new Error(
          "This purchase has supplier payment recorded. Reverse/refund the payment before cancelling the purchase."
        );
      }

      const items =
        db.prepare(`
          SELECT *
          FROM purchase_items
          WHERE purchase_id = ?
        `).all(id);

      for (
        const item of items
      ) {
        /*
         * Remove quantity/value from the
         * current weighted-average cost state.
         */
        const originalReceipt = db.prepare(`
          SELECT id, unit_cost
          FROM stock_transactions
          WHERE reference_type = 'PURCHASE'
            AND reference_id = ?
            AND item_id = ?
            AND transaction_type = 'PURCHASE'
          ORDER BY id
          LIMIT 1
        `).get(purchase.id, item.item_id);

        if (!originalReceipt) {
          throw new Error(
            `Original inventory receipt was not found for purchase ${purchase.purchase_no}.`,
          );
        }

        const laterOutgoing = db.prepare(`
          SELECT id, transaction_type, reference_no
          FROM stock_transactions
          WHERE item_id = ?
            AND id > ?
            AND quantity_out > 0
          ORDER BY id
          LIMIT 1
        `).get(item.item_id, originalReceipt.id);

        if (laterOutgoing) {
          throw new Error(
            `${purchase.purchase_no} cannot be cancelled because ${item.item_id} has subsequent stock usage. Use a supplier return/stock adjustment workflow instead.`,
          );
        }

        const originalUnitCost = Number(originalReceipt.unit_cost || 0);

        const costResult =
          reverseInventoryReceipt(
            item.item_id,
            item.quantity,
            originalUnitCost
          );

        addStockTransaction({
          transactionDate:
            new Date()
              .toISOString()
              .slice(0, 10),

          itemId:
            item.item_id,

          transactionType:
            "PURCHASE_CANCEL",

          referenceType:
            "PURCHASE",

          referenceId:
            purchase.id,

          referenceNo:
            purchase.purchase_no,

          quantityIn: 0,

          quantityOut:
            item.quantity,

          unitCost:
            costResult.unitCost,

          lotNo:
            item.lot_no ||
            null,

          expiryDate:
            item.expiry_date ||
            null,

          notes:
            `Cancellation of ${purchase.purchase_no}`,
        });
      }

      db.prepare(`
        UPDATE purchases
        SET
          status = 'CANCELLED',
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(id);

      return {
        id:
          purchase.id,

        purchaseNo:
          purchase.purchase_no,

        status:
          "CANCELLED",
      };
    });

  return transaction();
}