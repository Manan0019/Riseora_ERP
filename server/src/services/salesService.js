import db from "../db/database.js";

import {
  addStockTransaction,
  getItemStock,
} from "./stockService.js";

function generateInvoiceNumber() {
  const year = new Date().getFullYear();

  const lastInvoice = db.prepare(`
    SELECT id
    FROM sales_invoices
    ORDER BY id DESC
    LIMIT 1
  `).get();

  const nextNumber =
    (lastInvoice?.id || 0) + 1;

  return `INV-${year}-${String(nextNumber).padStart(5, "0")}`;
}

function getPaymentStatus(
  grandTotal,
  amountPaid
) {
  if (amountPaid <= 0) {
    return "UNPAID";
  }

  if (amountPaid >= grandTotal) {
    return "PAID";
  }

  return "PARTIAL";
}

export function createSale(data) {
  const transaction = db.transaction(() => {
    const invoiceNo =
      generateInvoiceNumber();

    let subtotal = 0;
    let gstAmount = 0;

    const calculatedItems =
      data.items.map((item) => {
        const itemId =
          Number(item.itemId);

        const quantity =
          Number(item.quantity);

        const rate =
          Number(item.rate);

        const discountAmount =
          Number(
            item.discountAmount || 0
          );

        const gstRate =
          Number(item.gstRate || 0);

        if (quantity <= 0) {
          throw new Error(
            "Sale quantity must be greater than zero."
          );
        }

        if (rate < 0) {
          throw new Error(
            "Sale rate cannot be negative."
          );
        }

        const currentStock =
          Number(
            getItemStock(itemId)
          );

        if (
          quantity >
          currentStock
        ) {
          throw new Error(
            `Insufficient stock. Available stock: ${currentStock.toFixed(
              3
            )}`
          );
        }

        const grossAmount =
          quantity * rate;

        if (
          discountAmount >
          grossAmount
        ) {
          throw new Error(
            "Discount cannot exceed line amount."
          );
        }

        const taxableAmount =
          grossAmount -
          discountAmount;

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
          itemId,
          quantity,
          rate,
          discountAmount,
          taxableAmount,
          gstRate,
          gstAmount:
            lineGst,
          lineTotal,
          lotNo:
            item.lotNo ||
            null,
        };
      });

    const invoiceDiscount =
      Number(
        data.discountAmount || 0
      );

    const otherCharges =
      Number(
        data.otherCharges || 0
      );

    if (
      invoiceDiscount >
      subtotal
    ) {
      throw new Error(
        "Invoice discount cannot exceed subtotal."
      );
    }

    const grandTotal =
      subtotal -
      invoiceDiscount +
      gstAmount +
      otherCharges;

    const amountPaid =
      Number(
        data.amountPaid || 0
      );

    if (
      amountPaid < 0
    ) {
      throw new Error(
        "Amount paid cannot be negative."
      );
    }

    if (
      amountPaid >
      grandTotal
    ) {
      throw new Error(
        "Amount paid cannot exceed invoice total."
      );
    }

    const paymentStatus =
      getPaymentStatus(
        grandTotal,
        amountPaid
      );

    const invoiceResult =
      db.prepare(`
        INSERT INTO sales_invoices (
          invoice_no,
          invoice_date,
          customer_id,
          customer_reference,
          subtotal,
          discount_amount,
          gst_amount,
          other_charges,
          grand_total,
          amount_paid,
          payment_status,
          notes
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        invoiceNo,
        data.invoiceDate,
        Number(
          data.customerId
        ),
        data.customerReference ||
          null,
        subtotal,
        invoiceDiscount,
        gstAmount,
        otherCharges,
        grandTotal,
        amountPaid,
        paymentStatus,
        data.notes || null
      );

    const salesInvoiceId =
      Number(
        invoiceResult.lastInsertRowid
      );

    const insertItem =
      db.prepare(`
        INSERT INTO sales_items (
          sales_invoice_id,
          item_id,
          quantity,
          rate,
          discount_amount,
          taxable_amount,
          gst_rate,
          gst_amount,
          line_total,
          lot_no
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

    for (
      const item of calculatedItems
    ) {
      insertItem.run(
        salesInvoiceId,
        item.itemId,
        item.quantity,
        item.rate,
        item.discountAmount,
        item.taxableAmount,
        item.gstRate,
        item.gstAmount,
        item.lineTotal,
        item.lotNo
      );

      addStockTransaction({
        transactionDate:
          data.invoiceDate,

        itemId:
          item.itemId,

        transactionType:
          "SALE",

        referenceType:
          "SALE",

        referenceId:
          salesInvoiceId,

        referenceNo:
          invoiceNo,

        quantityIn: 0,

        quantityOut:
          item.quantity,

        unitCost: 0,

        lotNo:
          item.lotNo,

        expiryDate:
          null,

        notes:
          `Sale ${invoiceNo}`,
      });
    }

    if (amountPaid > 0) {
      db.prepare(`
        INSERT INTO sales_payments (
          sales_invoice_id,
          payment_date,
          amount,
          payment_mode,
          reference_no,
          notes
        )
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        salesInvoiceId,
        data.invoiceDate,
        amountPaid,
        data.paymentMode ||
          "CASH",
        data.paymentReference ||
          null,
        "Payment received with invoice"
      );
    }

    return {
      salesInvoiceId,
      invoiceNo,
      subtotal,
      gstAmount,
      grandTotal,
      amountPaid,
      balanceAmount:
        grandTotal -
        amountPaid,
      paymentStatus,
    };
  });

  return transaction();
}