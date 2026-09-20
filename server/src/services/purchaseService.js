import db from "../db/database.js";

import {
  addStockTransaction,
} from "./stockService.js";

import {
  addInventoryValue,
  removeInventoryValue,
} from "./costService.js";

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
      const purchaseNo =
        generatePurchaseNumber();

      let subtotal = 0;
      let gstAmount = 0;

      const calculatedItems =
        data.items.map((item) => {
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

          if (
            quantity <= 0
          ) {
            throw new Error(
              "Purchase quantity must be greater than zero."
            );
          }

          if (
            rate < 0
          ) {
            throw new Error(
              "Purchase rate cannot be negative."
            );
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

            itemId:
              Number(
                item.itemId
              ),

            quantity,
            rate,
            gstRate,
            taxableAmount,

            gstAmount:
              lineGst,

            lineTotal,

            lotNo:
              item.lotNo ||
              null,

            mfgDate:
              item.mfgDate ||
              null,

            expiryDate:
              item.expiryDate ||
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
          data.supplierInvoiceNo ||
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
          item.rate
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
            item.rate,

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
        const costResult =
          removeInventoryValue(
            item.item_id,
            item.quantity
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