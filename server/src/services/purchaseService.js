import db from "../db/database.js";
import { addStockTransaction } from "./stockService.js";

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
  const transaction = db.transaction(() => {
    const purchaseNo =
      generatePurchaseNumber();

    let subtotal = 0;
    let gstAmount = 0;

    const calculatedItems =
      data.items.map((item) => {
        const quantity =
          Number(item.quantity);

        const rate =
          Number(item.rate);

        const gstRate =
          Number(item.gstRate || 0);

        const taxableAmount =
          quantity * rate;

        const lineGst =
          taxableAmount *
          (gstRate / 100);

        const lineTotal =
          taxableAmount +
          lineGst;

        subtotal += taxableAmount;
        gstAmount += lineGst;

        return {
          ...item,
          quantity,
          rate,
          gstRate,
          taxableAmount,
          gstAmount: lineGst,
          lineTotal,
        };
      });

    const freightAmount =
      Number(
        data.freightAmount || 0
      );

    const otherCharges =
      Number(
        data.otherCharges || 0
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
        Number(data.supplierId),
        data.supplierInvoiceNo || null,
        data.supplierInvoiceDate || null,
        subtotal,
        gstAmount,
        freightAmount,
        otherCharges,
        grandTotal,
        data.notes || null
      );

    const purchaseId =
      Number(
        purchaseResult.lastInsertRowid
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
      const item of calculatedItems
    ) {
      insertItem.run(
        purchaseId,
        Number(item.itemId),
        item.quantity,
        item.rate,
        item.taxableAmount,
        item.gstRate,
        item.gstAmount,
        item.lineTotal,
        item.lotNo || null,
        item.mfgDate || null,
        item.expiryDate || null
      );

      addStockTransaction({
        transactionDate:
          data.purchaseDate,

        itemId:
          Number(item.itemId),

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
          item.lotNo || null,

        expiryDate:
          item.expiryDate || null,

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