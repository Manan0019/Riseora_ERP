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

export function getSalesInvoices() {
  return db.prepare(`
    SELECT
      si.id,
      si.invoice_no,
      si.invoice_date,
      si.subtotal,
      si.discount_amount,
      si.gst_amount,
      si.other_charges,
      si.grand_total,
      si.amount_paid,
      si.payment_status,
      si.status,
      si.customer_reference,

      c.code AS customer_code,
      c.name AS customer_name

    FROM sales_invoices si

    INNER JOIN customers c
      ON c.id = si.customer_id

    ORDER BY
      si.invoice_date DESC,
      si.id DESC
  `).all();
}

export function getSalesInvoiceById(id) {
  const invoice = db.prepare(`
    SELECT
      si.*,

      c.code AS customer_code,
      c.name AS customer_name,
      c.phone AS customer_phone,
      c.gstin AS customer_gstin

    FROM sales_invoices si

    INNER JOIN customers c
      ON c.id = si.customer_id

    WHERE si.id = ?
  `).get(id);

  if (!invoice) {
    return null;
  }

  const items = db.prepare(`
    SELECT
      si.*,

      i.code AS item_code,
      i.name AS item_name,

      u.code AS unit_code

    FROM sales_items si

    INNER JOIN items i
      ON i.id = si.item_id

    INNER JOIN units u
      ON u.id = i.base_unit_id

    WHERE si.sales_invoice_id = ?

    ORDER BY si.id
  `).all(id);

  const payments = db.prepare(`
    SELECT *
    FROM sales_payments
    WHERE sales_invoice_id = ?
      AND status = 'POSTED'
    ORDER BY
      payment_date,
      id
  `).all(id);

  return {
    ...invoice,
    items,
    payments,
    balance_amount:
      Number(invoice.grand_total || 0) -
      Number(invoice.amount_paid || 0),
  };
}

export function addSalesPayment(
  invoiceId,
  data
) {
  const transaction = db.transaction(() => {
    const invoice = db.prepare(`
      SELECT *
      FROM sales_invoices
      WHERE id = ?
    `).get(invoiceId);

    if (!invoice) {
      throw new Error(
        "Sales invoice not found."
      );
    }

    if (
      invoice.status === "CANCELLED"
    ) {
      throw new Error(
        "Payment cannot be added to a cancelled invoice."
      );
    }

    const paymentAmount =
      Number(data.amount);

    if (paymentAmount <= 0) {
      throw new Error(
        "Payment amount must be greater than zero."
      );
    }

    const balance =
      Number(
        invoice.grand_total
      ) -
      Number(
        invoice.amount_paid
      );

    if (
      paymentAmount >
      balance
    ) {
      throw new Error(
        `Payment cannot exceed outstanding balance of ₹${balance.toFixed(
          2
        )}.`
      );
    }

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
      invoiceId,
      data.paymentDate,
      paymentAmount,
      data.paymentMode || "CASH",
      data.referenceNo || null,
      data.notes || null
    );

    const newAmountPaid =
      Number(
        invoice.amount_paid
      ) +
      paymentAmount;

    const newPaymentStatus =
      getPaymentStatus(
        Number(
          invoice.grand_total
        ),
        newAmountPaid
      );

    db.prepare(`
      UPDATE sales_invoices
      SET
        amount_paid = ?,
        payment_status = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      newAmountPaid,
      newPaymentStatus,
      invoiceId
    );

    return {
      invoiceId,
      amountPaid:
        newAmountPaid,
      balanceAmount:
        Number(
          invoice.grand_total
        ) -
        newAmountPaid,
      paymentStatus:
        newPaymentStatus,
    };
  });

  return transaction();
}