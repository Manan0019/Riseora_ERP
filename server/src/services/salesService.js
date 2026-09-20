import db from "../db/database.js";

import { addStockTransaction, getItemStock } from "./stockService.js";

import { addInventoryValue, removeInventoryValue } from "./costService.js";

function generateInvoiceNumber() {
  const year = new Date().getFullYear();

  const lastInvoice = db
    .prepare(
      `
      SELECT id
      FROM sales_invoices
      ORDER BY id DESC
      LIMIT 1
    `,
    )
    .get();

  const nextNumber = (lastInvoice?.id || 0) + 1;

  return `INV-${year}-${String(nextNumber).padStart(5, "0")}`;
}

function getPaymentStatus(grandTotal, amountPaid) {
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
    if (!Array.isArray(data.items) || data.items.length === 0) {
      throw new Error("At least one product is required.");
    }

    /*
     * Prevent duplicate product rows.
     *
     * This is important because the
     * current stock transaction model
     * identifies COGS by invoice + item.
     */
    const itemIds = data.items.map((item) => Number(item.itemId));

    const duplicateItemId = itemIds.find(
      (itemId, index) => itemIds.indexOf(itemId) !== index,
    );

    if (duplicateItemId) {
      throw new Error(
        "The same product cannot be entered more than once on one sales invoice. Please combine the quantities into one line.",
      );
    }

    const invoiceNo = generateInvoiceNumber();

    let subtotal = 0;
    let gstAmount = 0;

    const calculatedItems = data.items.map((item) => {
      const itemId = Number(item.itemId);

      const quantity = Number(item.quantity);

      const rate = Number(item.rate);

      const discountAmount = Number(item.discountAmount || 0);

      const gstRate = Number(item.gstRate || 0);

      if (!itemId || itemId <= 0) {
        throw new Error("Please select a valid product.");
      }

      if (quantity <= 0) {
        throw new Error("Sale quantity must be greater than zero.");
      }

      if (rate < 0) {
        throw new Error("Sale rate cannot be negative.");
      }

      if (discountAmount < 0) {
        throw new Error("Discount cannot be negative.");
      }

      if (gstRate < 0) {
        throw new Error("GST rate cannot be negative.");
      }

      const currentStock = Number(getItemStock(itemId));

      if (quantity > currentStock) {
        throw new Error(
          `Insufficient stock. Available stock: ${currentStock.toFixed(3)}`,
        );
      }

      const grossAmount = quantity * rate;

      if (discountAmount > grossAmount) {
        throw new Error("Discount cannot exceed line amount.");
      }

      const taxableAmount = grossAmount - discountAmount;

      const lineGst = taxableAmount * (gstRate / 100);

      const lineTotal = taxableAmount + lineGst;

      subtotal += taxableAmount;

      gstAmount += lineGst;

      return {
        itemId,
        quantity,
        rate,
        discountAmount,
        taxableAmount,
        gstRate,

        gstAmount: lineGst,

        lineTotal,

        lotNo: item.lotNo || null,
      };
    });

    const invoiceDiscount = Number(data.discountAmount || 0);

    const otherCharges = Number(data.otherCharges || 0);

    if (invoiceDiscount < 0) {
      throw new Error("Invoice discount cannot be negative.");
    }

    if (invoiceDiscount > subtotal) {
      throw new Error("Invoice discount cannot exceed subtotal.");
    }

    if (otherCharges < 0) {
      throw new Error("Other charges cannot be negative.");
    }

    /*
     * subtotal already contains
     * line-level discounts.
     *
     * Invoice-level discount is
     * deducted separately.
     */
    const grandTotal = subtotal - invoiceDiscount + gstAmount + otherCharges;

    const amountPaid = Number(data.amountPaid || 0);

    if (amountPaid < 0) {
      throw new Error("Amount paid cannot be negative.");
    }

    if (amountPaid > grandTotal) {
      throw new Error("Amount paid cannot exceed invoice total.");
    }

    const paymentStatus = getPaymentStatus(grandTotal, amountPaid);

    const invoiceResult = db
      .prepare(
        `
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
        `,
      )
      .run(
        invoiceNo,
        data.invoiceDate,

        Number(data.customerId),

        data.customerReference || null,

        subtotal,
        invoiceDiscount,
        gstAmount,
        otherCharges,
        grandTotal,
        amountPaid,
        paymentStatus,

        data.notes || null,
      );

    const salesInvoiceId = Number(invoiceResult.lastInsertRowid);

    const insertItem = db.prepare(`
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

    let totalCogs = 0;

    /*
     * Post every sales line.
     */
    for (const item of calculatedItems) {
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
        item.lotNo,
      );

      /*
       * SALES COGS
       *
       * Remove finished goods using
       * the current weighted average
       * inventory cost.
       */
      const costResult = removeInventoryValue(item.itemId, item.quantity);

      totalCogs += Number(costResult.valueRemoved || 0);

      /*
       * Store the COGS unit cost
       * in the stock transaction.
       */
      addStockTransaction({
        transactionDate: data.invoiceDate,

        itemId: item.itemId,

        transactionType: "SALE",

        referenceType: "SALE",

        referenceId: salesInvoiceId,

        referenceNo: invoiceNo,

        quantityIn: 0,

        quantityOut: item.quantity,

        unitCost: costResult.unitCost,

        lotNo: item.lotNo,

        expiryDate: null,

        notes: `Sale ${invoiceNo}`,
      });
    }

    /*
     * Record initial payment
     * received with invoice.
     */
    if (amountPaid > 0) {
      db.prepare(
        `
          INSERT INTO sales_payments (
            sales_invoice_id,
            payment_date,
            amount,
            payment_mode,
            reference_no,
            notes
          )
          VALUES (?, ?, ?, ?, ?, ?)
        `,
      ).run(
        salesInvoiceId,

        data.invoiceDate,

        amountPaid,

        data.paymentMode || "CASH",

        data.paymentReference || null,

        "Payment received with invoice",
      );
    }

    const netSales = subtotal - invoiceDiscount;

    const grossProfit = netSales - totalCogs;

    const grossMarginPercent =
      netSales > 0 ? (grossProfit / netSales) * 100 : 0;

    return {
      salesInvoiceId,
      invoiceNo,
      subtotal,
      gstAmount,
      invoiceDiscount,
      grandTotal,
      amountPaid,

      balanceAmount: grandTotal - amountPaid,

      paymentStatus,

      totalCogs,
      netSales,
      grossProfit,
      grossMarginPercent,
    };
  });

  return transaction();
}

export function getSalesInvoices() {
  return db
    .prepare(
      `
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
      ON c.id =
         si.customer_id

    ORDER BY
      si.invoice_date DESC,
      si.id DESC
  `,
    )
    .all();
}

export function getSalesInvoiceById(id) {
  const invoice = db
    .prepare(
      `
      SELECT
        si.*,

        c.code AS customer_code,
        c.name AS customer_name,
        c.phone AS customer_phone,
        c.gstin AS customer_gstin

      FROM sales_invoices si

      INNER JOIN customers c
        ON c.id =
           si.customer_id

      WHERE si.id = ?
    `,
    )
    .get(id);

  if (!invoice) {
    return null;
  }

  /*
   * Get sales items.
   *
   * cogs_unit_cost is read from
   * the corresponding SALE stock
   * transaction.
   */
  const items = db
    .prepare(
      `
      SELECT
        si.*,

        i.code AS item_code,
        i.name AS item_name,

        u.code AS unit_code,

        COALESCE(
          (
            SELECT
              st.unit_cost

            FROM stock_transactions st

            WHERE
              st.reference_type =
                'SALE'

              AND
              st.reference_id =
                si.sales_invoice_id

              AND
              st.item_id =
                si.item_id

              AND
              st.transaction_type =
                'SALE'

            ORDER BY
              st.id

            LIMIT 1
          ),
          0
        ) AS cogs_unit_cost

      FROM sales_items si

      INNER JOIN items i
        ON i.id =
           si.item_id

      INNER JOIN units u
        ON u.id =
           i.base_unit_id

      WHERE
        si.sales_invoice_id = ?

      ORDER BY
        si.id
    `,
    )
    .all(id);

  const itemsWithCogs = items.map((item) => {
    const quantity = Number(item.quantity || 0);

    const taxableAmount = Number(item.taxable_amount || 0);

    const cogsUnitCost = Number(item.cogs_unit_cost || 0);

    const cogsAmount = quantity * cogsUnitCost;

    const grossProfit = taxableAmount - cogsAmount;

    const grossMarginPercent =
      taxableAmount > 0 ? (grossProfit / taxableAmount) * 100 : 0;

    return {
      ...item,

      cogs_unit_cost: cogsUnitCost,

      cogs_amount: cogsAmount,

      gross_profit: grossProfit,

      gross_margin_percent: grossMarginPercent,
    };
  });

  const payments = db
    .prepare(
      `
      SELECT *
      FROM sales_payments

      WHERE
        sales_invoice_id = ?

        AND
        status = 'POSTED'

      ORDER BY
        payment_date,
        id
    `,
    )
    .all(id);

  const totalCogs = itemsWithCogs.reduce(
    (total, item) => total + Number(item.cogs_amount || 0),
    0,
  );

  /*
   * subtotal already includes
   * line discounts.
   *
   * discount_amount is the
   * invoice-level discount.
   */
  const netSales =
    Number(invoice.subtotal || 0) - Number(invoice.discount_amount || 0);

  const grossProfit = netSales - totalCogs;

  const grossMarginPercent = netSales > 0 ? (grossProfit / netSales) * 100 : 0;

  return {
    ...invoice,

    items: itemsWithCogs,

    payments,

    balance_amount:
      Number(invoice.grand_total || 0) - Number(invoice.amount_paid || 0),

    net_sales: netSales,

    total_cogs: totalCogs,

    gross_profit: grossProfit,

    gross_margin_percent: grossMarginPercent,
  };
}

export function addSalesPayment(invoiceId, data) {
  const transaction = db.transaction(() => {
    const invoice = db
      .prepare(
        `
          SELECT *
          FROM sales_invoices
          WHERE id = ?
        `,
      )
      .get(invoiceId);

    if (!invoice) {
      throw new Error("Sales invoice not found.");
    }

    if (invoice.status === "CANCELLED") {
      throw new Error("Payment cannot be added to a cancelled invoice.");
    }

    const paymentAmount = Number(data.amount);

    if (paymentAmount <= 0) {
      throw new Error("Payment amount must be greater than zero.");
    }

    const balance = Number(invoice.grand_total) - Number(invoice.amount_paid);

    if (paymentAmount > balance) {
      throw new Error(
        `Payment cannot exceed outstanding balance of ₹${balance.toFixed(2)}.`,
      );
    }

    db.prepare(
      `
        INSERT INTO sales_payments (
          sales_invoice_id,
          payment_date,
          amount,
          payment_mode,
          reference_no,
          notes
        )
        VALUES (?, ?, ?, ?, ?, ?)
      `,
    ).run(
      invoiceId,

      data.paymentDate,

      paymentAmount,

      data.paymentMode || "CASH",

      data.referenceNo || null,

      data.notes || null,
    );

    const newAmountPaid = Number(invoice.amount_paid) + paymentAmount;

    const newPaymentStatus = getPaymentStatus(
      Number(invoice.grand_total),
      newAmountPaid,
    );

    db.prepare(
      `
        UPDATE sales_invoices
        SET
          amount_paid = ?,
          payment_status = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `,
    ).run(newAmountPaid, newPaymentStatus, invoiceId);

    return {
      invoiceId,

      amountPaid: newAmountPaid,

      balanceAmount: Number(invoice.grand_total) - newAmountPaid,

      paymentStatus: newPaymentStatus,
    };
  });

  return transaction();
}

export function cancelSale(invoiceId) {
  const transaction = db.transaction(() => {
    const invoice = db
      .prepare(
        `
          SELECT *
          FROM sales_invoices
          WHERE id = ?
        `,
      )
      .get(invoiceId);

    if (!invoice) {
      throw new Error("Sales invoice not found.");
    }

    if (invoice.status === "CANCELLED") {
      throw new Error("Sales invoice is already cancelled.");
    }

    /*
     * Payment safety.
     *
     * We do not silently delete or
     * reverse money received.
     */
    if (Number(invoice.amount_paid || 0) > 0) {
      throw new Error(
        "This invoice has received payment. Record a refund/credit note before cancellation.",
      );
    }

    const items = db
      .prepare(
        `
          SELECT *
          FROM sales_items
          WHERE sales_invoice_id = ?
        `,
      )
      .all(invoiceId);

    for (const item of items) {
      /*
       * Find the exact unit cost used
       * when the original sale removed
       * this item from inventory.
       */
      const saleCost = db
        .prepare(
          `
            SELECT
              unit_cost

            FROM stock_transactions

            WHERE
              reference_type =
                'SALE'

              AND
              reference_id = ?

              AND
              item_id = ?

              AND
              transaction_type =
                'SALE'

            ORDER BY
              id

            LIMIT 1
          `,
        )
        .get(invoice.id, item.item_id);

      const originalUnitCost = Number(saleCost?.unit_cost || 0);

      /*
       * Restore quantity AND
       * inventory value.
       */
      addInventoryValue(item.item_id, Number(item.quantity), originalUnitCost);

      /*
       * Stock ledger reversal.
       */
      addStockTransaction({
        transactionDate: new Date().toISOString().slice(0, 10),

        itemId: item.item_id,

        transactionType: "SALE_CANCEL",

        referenceType: "SALE",

        referenceId: invoice.id,

        referenceNo: invoice.invoice_no,

        quantityIn: item.quantity,

        quantityOut: 0,

        unitCost: originalUnitCost,

        lotNo: item.lot_no || null,

        expiryDate: null,

        notes: `Cancellation of ${invoice.invoice_no}`,
      });
    }

    db.prepare(
      `
        UPDATE sales_invoices
        SET
          status = 'CANCELLED',
          payment_status = 'CANCELLED',
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `,
    ).run(invoiceId);

    return {
      invoiceId: invoice.id,

      invoiceNo: invoice.invoice_no,

      status: "CANCELLED",
    };
  });

  return transaction();
}
