import db from "../db/database.js";
import { addStockTransaction, getItemStock } from "./stockService.js";
import { addInventoryValue, removeInventoryValue } from "./costService.js";
import { getCustomerOutstanding } from "./customerLedgerService.js";

const EPSILON = 0.000001;


function addDaysToDate(dateText, days) {
  const date = new Date(`${dateText}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) {
    throw new Error("A valid invoice date is required.");
  }
  date.setUTCDate(date.getUTCDate() + Number(days || 0));
  return date.toISOString().slice(0, 10);
}

function generateInvoiceNumber() {
  const year = new Date().getFullYear();
  const lastInvoice = db.prepare(`
    SELECT id FROM sales_invoices ORDER BY id DESC LIMIT 1
  `).get();
  const nextNumber = Number(lastInvoice?.id || 0) + 1;
  return `INV-${year}-${String(nextNumber).padStart(5, "0")}`;
}

function generateRefundNumber() {
  const year = new Date().getFullYear();
  const lastRefund = db.prepare(`
    SELECT id FROM sales_refunds ORDER BY id DESC LIMIT 1
  `).get();
  const nextNumber = Number(lastRefund?.id || 0) + 1;
  return `REF-${year}-${String(nextNumber).padStart(5, "0")}`;
}


function normalizeState(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function resolveTaxType(companyState, customerState, requestedTaxType) {
  if (["INTRA_STATE", "INTER_STATE"].includes(requestedTaxType)) {
    return requestedTaxType;
  }

  const sellerState = normalizeState(companyState);
  const buyerState = normalizeState(customerState);

  if (sellerState && buyerState && sellerState !== buyerState) {
    return "INTER_STATE";
  }

  return "INTRA_STATE";
}

function getBasePaymentStatus(total, paid) {
  if (paid <= EPSILON) return "UNPAID";
  if (paid + EPSILON >= total) return "PAID";
  return "PARTIAL";
}

export function getInvoiceFinancialSummary(invoiceOrId) {
  const invoice = typeof invoiceOrId === "object"
    ? invoiceOrId
    : db.prepare(`SELECT * FROM sales_invoices WHERE id = ?`).get(Number(invoiceOrId));

  if (!invoice) {
    throw new Error("Sales invoice not found.");
  }

  if (invoice.status === "CANCELLED") {
    return {
      creditedAmount: 0,
      refundedAmount: 0,
      effectiveInvoiceTotal: 0,
      netAmountPaid: 0,
      balanceAmount: 0,
      refundDue: 0,
      paymentStatus: "CANCELLED",
    };
  }

  const creditRow = db.prepare(`
    SELECT COALESCE(SUM(grand_total), 0) AS total
    FROM sales_credit_notes
    WHERE sales_invoice_id = ? AND status = 'POSTED'
  `).get(invoice.id);

  const refundRow = db.prepare(`
    SELECT COALESCE(SUM(amount), 0) AS total
    FROM sales_refunds
    WHERE sales_invoice_id = ? AND status = 'POSTED'
  `).get(invoice.id);

  const creditedAmount = Number(creditRow?.total || 0);
  const refundedAmount = Number(refundRow?.total || 0);
  const effectiveInvoiceTotal = Math.max(
    0,
    Number(invoice.grand_total || 0) - creditedAmount,
  );
  const netAmountPaid = Math.max(
    0,
    Number(invoice.amount_paid || 0) - refundedAmount,
  );
  const balanceAmount = Math.max(0, effectiveInvoiceTotal - netAmountPaid);
  const refundDue = Math.max(0, netAmountPaid - effectiveInvoiceTotal);

  let paymentStatus;
  if (refundDue > EPSILON) {
    paymentStatus = "REFUND_DUE";
  } else {
    paymentStatus = getBasePaymentStatus(effectiveInvoiceTotal, netAmountPaid);
  }

  return {
    creditedAmount,
    refundedAmount,
    effectiveInvoiceTotal,
    netAmountPaid,
    balanceAmount,
    refundDue,
    paymentStatus,
  };
}

export function refreshInvoicePaymentStatus(invoiceId) {
  const invoice = db.prepare(`SELECT * FROM sales_invoices WHERE id = ?`).get(Number(invoiceId));
  if (!invoice) throw new Error("Sales invoice not found.");

  const summary = getInvoiceFinancialSummary(invoice);
  db.prepare(`
    UPDATE sales_invoices
    SET payment_status = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(summary.paymentStatus, invoice.id);

  return summary;
}

export function createSale(data) {
  const transaction = db.transaction(() => {
    if (!Array.isArray(data.items) || data.items.length === 0) {
      throw new Error("At least one product is required.");
    }

    const customer = db.prepare(`SELECT * FROM customers WHERE id = ?`).get(Number(data.customerId));
    if (!customer) throw new Error("Please select a valid customer.");
    if (Number(customer.is_active) !== 1) {
      throw new Error("Inactive customers cannot be used on a new sales invoice.");
    }

    const company = db.prepare(`SELECT * FROM companies ORDER BY id LIMIT 1`).get() || {};
    const taxType = resolveTaxType(company.state, customer.state, data.taxType);
    const placeOfSupply = String(data.placeOfSupply || customer.state || "").trim() || null;

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

      if (!itemId || itemId <= 0) throw new Error("Please select a valid product.");
      if (!Number.isFinite(quantity) || quantity <= 0) throw new Error("Sale quantity must be greater than zero.");
      if (!Number.isFinite(rate) || rate < 0) throw new Error("Sale rate cannot be negative.");
      if (!Number.isFinite(discountAmount) || discountAmount < 0) throw new Error("Discount cannot be negative.");
      if (!Number.isFinite(gstRate) || gstRate < 0 || gstRate > 100) throw new Error("GST rate must be between 0 and 100 percent.");

      const masterItem = db.prepare(`
        SELECT i.*, u.code AS unit_code, c.code AS category_code
        FROM items i
        INNER JOIN units u ON u.id = i.base_unit_id
        INNER JOIN item_categories c ON c.id = i.category_id
        WHERE i.id = ?
      `).get(itemId);
      if (!masterItem) throw new Error("Selected product was not found.");
      if (Number(masterItem.is_active) !== 1) {
        throw new Error(`${masterItem.name}: inactive items cannot be sold on a new invoice.`);
      }
      if (masterItem.category_code !== "FG") {
        throw new Error(`${masterItem.name}: only Finished Goods (FG) can be sold through Sales Invoice.`);
      }

      const currentStock = Number(getItemStock(itemId));
      if (quantity > currentStock + EPSILON) {
        throw new Error(`Insufficient stock. Available stock: ${currentStock.toFixed(3)}`);
      }

      const grossAmount = quantity * rate;
      if (discountAmount > grossAmount + EPSILON) {
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
        itemCode: masterItem.code,
        itemName: masterItem.name,
        unitCode: masterItem.unit_code,
        hsnCode: masterItem.hsn_code || null,
      };
    });

    const invoiceDiscount = Number(data.discountAmount || 0);
    const otherCharges = Number(data.otherCharges || 0);
    if (!Number.isFinite(invoiceDiscount) || invoiceDiscount < 0) throw new Error("Invoice discount cannot be negative.");
    if (invoiceDiscount > subtotal + EPSILON) throw new Error("Invoice discount cannot exceed subtotal.");
    if (!Number.isFinite(otherCharges) || otherCharges < 0) throw new Error("Other charges cannot be negative.");

    gstAmount = 0;
    for (const item of calculatedItems) {
      const invoiceDiscountShare = subtotal > 0
        ? invoiceDiscount * (item.taxableAmount / subtotal)
        : 0;
      const discountedTaxable = Math.max(0, item.taxableAmount - invoiceDiscountShare);
      item.gstAmount = discountedTaxable * (item.gstRate / 100);
      item.lineTotal = discountedTaxable + item.gstAmount;
      gstAmount += item.gstAmount;
    }

    const grandTotal = subtotal - invoiceDiscount + gstAmount + otherCharges;
    const amountPaid = Number(data.amountPaid || 0);
    if (!Number.isFinite(amountPaid) || amountPaid < 0) throw new Error("Amount paid cannot be negative.");
    if (amountPaid > grandTotal + EPSILON) throw new Error("Amount paid cannot exceed invoice total.");

    const creditDaysSnapshot = Number(customer.credit_days || 0);
    const dueDate = addDaysToDate(data.invoiceDate, creditDaysSnapshot);
    const invoiceCreditExposure = Math.max(0, grandTotal - amountPaid);
    const creditLimit = Number(customer.credit_limit || 0);
    if (creditLimit > EPSILON && invoiceCreditExposure > EPSILON) {
      const currentRow = getCustomerOutstanding().find(
        (row) => Number(row.customer_id) === Number(customer.id),
      );
      const currentOutstanding = Number(currentRow?.outstanding || 0);
      const projectedOutstanding = currentOutstanding + invoiceCreditExposure;
      if (projectedOutstanding > creditLimit + EPSILON) {
        throw new Error(
          `Customer credit limit would be exceeded. Current balance: ₹${currentOutstanding.toFixed(2)}, this invoice credit: ₹${invoiceCreditExposure.toFixed(2)}, limit: ₹${creditLimit.toFixed(2)}.`,
        );
      }
    }

    const paymentStatus = getBasePaymentStatus(grandTotal, amountPaid);
    const invoiceResult = db.prepare(`
      INSERT INTO sales_invoices (
        invoice_no, invoice_date, customer_id, customer_reference,
        subtotal, discount_amount, gst_amount, other_charges, grand_total,
        amount_paid, payment_status, notes, place_of_supply, tax_type,
        seller_name, seller_legal_name, seller_gstin, seller_address,
        seller_city, seller_state, seller_pincode, seller_phone, seller_email,
        seller_bank_name, seller_bank_account_name, seller_bank_account_no,
        seller_bank_ifsc, seller_upi_id, invoice_terms_snapshot,
        buyer_code, buyer_name, buyer_phone, buyer_email, buyer_gstin,
        buyer_address, buyer_city, buyer_state, buyer_pincode
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?, ?, ?, ?
      )
    `).run(
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
      placeOfSupply,
      taxType,
      company.name || null,
      company.legal_name || null,
      company.gstin || null,
      company.address || null,
      company.city || null,
      company.state || null,
      company.pincode || null,
      company.phone || null,
      company.email || null,
      company.bank_name || null,
      company.bank_account_name || null,
      company.bank_account_no || null,
      company.bank_ifsc || null,
      company.upi_id || null,
      company.invoice_terms || null,
      customer.code || null,
      customer.name || null,
      customer.phone || null,
      customer.email || null,
      customer.gstin || null,
      customer.address || null,
      customer.city || null,
      customer.state || null,
      customer.pincode || null,
    );

    const salesInvoiceId = Number(invoiceResult.lastInsertRowid);

    db.prepare(`
      UPDATE sales_invoices
      SET credit_days_snapshot = ?, due_date = ?
      WHERE id = ?
    `).run(creditDaysSnapshot, dueDate, salesInvoiceId);

    const insertItem = db.prepare(`
      INSERT INTO sales_items (
        sales_invoice_id, item_id, quantity, rate, discount_amount,
        taxable_amount, gst_rate, gst_amount, line_total, lot_no,
        item_code_snapshot, item_name_snapshot, unit_code_snapshot, hsn_code_snapshot
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    let totalCogs = 0;
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
        item.itemCode,
        item.itemName,
        item.unitCode,
        item.hsnCode,
      );

      const costResult = removeInventoryValue(item.itemId, item.quantity);
      totalCogs += Number(costResult.valueRemoved || 0);
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

    if (amountPaid > 0) {
      db.prepare(`
        INSERT INTO sales_payments (
          sales_invoice_id, payment_date, amount, payment_mode, reference_no, notes
        ) VALUES (?, ?, ?, ?, ?, ?)
      `).run(
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
    const grossMarginPercent = netSales > 0 ? (grossProfit / netSales) * 100 : 0;

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
      taxType,
      placeOfSupply,
      totalCogs,
      netSales,
      grossProfit,
      grossMarginPercent,
      creditDaysSnapshot,
      dueDate,
    };
  });

  return transaction();
}

export function getSalesInvoices() {
  const invoices = db.prepare(`
    SELECT
      si.id, si.invoice_no, si.invoice_date, si.due_date, si.credit_days_snapshot, si.subtotal,
      si.discount_amount, si.gst_amount, si.other_charges, si.grand_total,
      si.amount_paid, si.payment_status, si.status, si.customer_reference,
      c.code AS customer_code, c.name AS customer_name
    FROM sales_invoices si
    INNER JOIN customers c ON c.id = si.customer_id
    ORDER BY si.invoice_date DESC, si.id DESC
  `).all();

  return invoices.map((invoice) => {
    const financial = getInvoiceFinancialSummary(invoice);
    return {
      ...invoice,
      credited_amount: financial.creditedAmount,
      refunded_amount: financial.refundedAmount,
      effective_invoice_total: financial.effectiveInvoiceTotal,
      net_amount_paid: financial.netAmountPaid,
      balance_amount: financial.balanceAmount,
      refund_due: financial.refundDue,
      payment_status: financial.paymentStatus,
    };
  });
}

export function getSalesInvoiceById(id) {
  const invoice = db.prepare(`
    SELECT
      si.*,
      COALESCE(si.buyer_code, c.code) AS customer_code,
      COALESCE(si.buyer_name, c.name) AS customer_name,
      COALESCE(si.buyer_phone, c.phone) AS customer_phone,
      COALESCE(si.buyer_email, c.email) AS customer_email,
      COALESCE(si.buyer_gstin, c.gstin) AS customer_gstin,
      COALESCE(si.buyer_address, c.address) AS customer_address,
      COALESCE(si.buyer_city, c.city) AS customer_city,
      COALESCE(si.buyer_state, c.state) AS customer_state,
      COALESCE(si.buyer_pincode, c.pincode) AS customer_pincode
    FROM sales_invoices si
    INNER JOIN customers c ON c.id = si.customer_id
    WHERE si.id = ?
  `).get(Number(id));

  if (!invoice) return null;

  const items = db.prepare(`
    SELECT
      si.*,
      COALESCE(si.item_code_snapshot, i.code) AS item_code,
      COALESCE(si.item_name_snapshot, i.name) AS item_name,
      COALESCE(si.unit_code_snapshot, u.code) AS unit_code,
      COALESCE(si.hsn_code_snapshot, i.hsn_code) AS hsn_code,
      COALESCE((
        SELECT st.unit_cost
        FROM stock_transactions st
        WHERE st.reference_type = 'SALE'
          AND st.reference_id = si.sales_invoice_id
          AND st.item_id = si.item_id
          AND st.transaction_type = 'SALE'
        ORDER BY st.id LIMIT 1
      ), 0) AS cogs_unit_cost
    FROM sales_items si
    INNER JOIN items i ON i.id = si.item_id
    INNER JOIN units u ON u.id = i.base_unit_id
    WHERE si.sales_invoice_id = ?
    ORDER BY si.id
  `).all(invoice.id);

  const itemsWithCogs = items.map((item) => {
    const quantity = Number(item.quantity || 0);
    const taxableAmount = Number(item.taxable_amount || 0);
    const invoiceDiscountShare = Number(invoice.subtotal || 0) > EPSILON
      ? Number(invoice.discount_amount || 0) * (taxableAmount / Number(invoice.subtotal || 0))
      : 0;
    const netSalesAmount = Math.max(0, taxableAmount - invoiceDiscountShare);
    const cogsUnitCost = Number(item.cogs_unit_cost || 0);
    const cogsAmount = quantity * cogsUnitCost;
    const grossProfit = netSalesAmount - cogsAmount;
    return {
      ...item,
      invoice_discount_share: invoiceDiscountShare,
      net_sales_amount: netSalesAmount,
      cogs_unit_cost: cogsUnitCost,
      cogs_amount: cogsAmount,
      gross_profit: grossProfit,
      gross_margin_percent: netSalesAmount > 0 ? (grossProfit / netSalesAmount) * 100 : 0,
    };
  });

  const payments = db.prepare(`
    SELECT * FROM sales_payments
    WHERE sales_invoice_id = ? AND status = 'POSTED'
    ORDER BY payment_date, id
  `).all(invoice.id);

  const creditNotes = db.prepare(`
    SELECT * FROM sales_credit_notes
    WHERE sales_invoice_id = ? AND status = 'POSTED'
    ORDER BY credit_note_date, id
  `).all(invoice.id);

  const refunds = db.prepare(`
    SELECT * FROM sales_refunds
    WHERE sales_invoice_id = ? AND status = 'POSTED'
    ORDER BY refund_date, id
  `).all(invoice.id);

  const totalCogs = itemsWithCogs.reduce(
    (total, item) => total + Number(item.cogs_amount || 0),
    0,
  );

  const returned = db.prepare(`
    SELECT
      COALESCE(SUM(scni.quantity * scni.unit_cost), 0) AS returned_cogs,
      COALESCE(SUM(scni.taxable_amount), 0) AS returned_taxable
    FROM sales_credit_note_items scni
    INNER JOIN sales_credit_notes scn ON scn.id = scni.sales_credit_note_id
    WHERE scn.sales_invoice_id = ? AND scn.status = 'POSTED'
  `).get(invoice.id);

  const creditDiscountRow = db.prepare(`
    SELECT COALESCE(SUM(discount_amount), 0) AS total
    FROM sales_credit_notes
    WHERE sales_invoice_id = ? AND status = 'POSTED'
  `).get(invoice.id);

  const originalNetSales = Number(invoice.subtotal || 0) - Number(invoice.discount_amount || 0);
  const returnedNetSales = Number(returned?.returned_taxable || 0) - Number(creditDiscountRow?.total || 0);
  const netSales = Math.max(0, originalNetSales - returnedNetSales);
  const netCogs = Math.max(0, totalCogs - Number(returned?.returned_cogs || 0));
  const grossProfit = netSales - netCogs;
  const financial = getInvoiceFinancialSummary(invoice);

  return {
    ...invoice,
    items: itemsWithCogs,
    payments,
    credit_notes: creditNotes,
    refunds,
    credited_amount: financial.creditedAmount,
    refunded_amount: financial.refundedAmount,
    effective_invoice_total: financial.effectiveInvoiceTotal,
    net_amount_paid: financial.netAmountPaid,
    balance_amount: financial.balanceAmount,
    refund_due: financial.refundDue,
    payment_status: financial.paymentStatus,
    net_sales: netSales,
    total_cogs: netCogs,
    gross_profit: grossProfit,
    gross_margin_percent: netSales > 0 ? (grossProfit / netSales) * 100 : 0,
  };
}

export function addSalesPayment(invoiceId, data) {
  const transaction = db.transaction(() => {
    const invoice = db.prepare(`SELECT * FROM sales_invoices WHERE id = ?`).get(Number(invoiceId));
    if (!invoice) throw new Error("Sales invoice not found.");
    if (invoice.status === "CANCELLED") throw new Error("Payment cannot be added to a cancelled invoice.");

    const paymentAmount = Number(data.amount);
    if (!data.paymentDate) throw new Error("Payment date is required.");
    if (String(data.paymentDate) < String(invoice.invoice_date)) {
      throw new Error("Payment date cannot be earlier than the invoice date.");
    }
    if (!Number.isFinite(paymentAmount) || paymentAmount <= 0) {
      throw new Error("Payment amount must be greater than zero.");
    }

    const before = getInvoiceFinancialSummary(invoice);
    if (before.refundDue > EPSILON) {
      throw new Error("This invoice already has a refund due. Record the refund before receiving another payment.");
    }
    if (paymentAmount > before.balanceAmount + EPSILON) {
      throw new Error(`Payment cannot exceed outstanding balance of ₹${before.balanceAmount.toFixed(2)}.`);
    }

    db.prepare(`
      INSERT INTO sales_payments (
        sales_invoice_id, payment_date, amount, payment_mode, reference_no, notes
      ) VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      invoice.id,
      data.paymentDate,
      paymentAmount,
      data.paymentMode || "CASH",
      data.referenceNo || null,
      data.notes || null,
    );

    const newAmountPaid = Number(invoice.amount_paid || 0) + paymentAmount;
    db.prepare(`
      UPDATE sales_invoices
      SET amount_paid = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(newAmountPaid, invoice.id);

    const summary = refreshInvoicePaymentStatus(invoice.id);
    return {
      invoiceId: invoice.id,
      amountPaid: newAmountPaid,
      balanceAmount: summary.balanceAmount,
      refundDue: summary.refundDue,
      paymentStatus: summary.paymentStatus,
    };
  });

  return transaction();
}

export function addSalesRefund(invoiceId, data) {
  const transaction = db.transaction(() => {
    const invoice = db.prepare(`SELECT * FROM sales_invoices WHERE id = ?`).get(Number(invoiceId));
    if (!invoice) throw new Error("Sales invoice not found.");
    if (invoice.status === "CANCELLED") throw new Error("Refund cannot be added to a cancelled invoice.");

    const amount = Number(data.amount);
    if (!data.refundDate) throw new Error("Refund date is required.");
    if (String(data.refundDate) < String(invoice.invoice_date)) {
      throw new Error("Refund date cannot be earlier than the invoice date.");
    }
    if (!Number.isFinite(amount) || amount <= 0) throw new Error("Refund amount must be greater than zero.");

    const before = getInvoiceFinancialSummary(invoice);
    if (before.refundDue <= EPSILON) throw new Error("There is no refund due on this invoice.");
    if (amount > before.refundDue + EPSILON) {
      throw new Error(`Refund cannot exceed refund due of ₹${before.refundDue.toFixed(2)}.`);
    }

    const refundNo = generateRefundNumber();
    const result = db.prepare(`
      INSERT INTO sales_refunds (
        refund_no, refund_date, sales_invoice_id, customer_id,
        amount, refund_mode, reference_no, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      refundNo,
      data.refundDate,
      invoice.id,
      invoice.customer_id,
      amount,
      data.refundMode || "CASH",
      data.referenceNo || null,
      data.notes || null,
    );

    const summary = refreshInvoicePaymentStatus(invoice.id);
    return {
      refundId: Number(result.lastInsertRowid),
      refundNo,
      invoiceId: invoice.id,
      amount,
      refundDue: summary.refundDue,
      paymentStatus: summary.paymentStatus,
    };
  });

  return transaction();
}

export function cancelSale(invoiceId) {
  const transaction = db.transaction(() => {
    const invoice = db.prepare(`SELECT * FROM sales_invoices WHERE id = ?`).get(Number(invoiceId));
    if (!invoice) throw new Error("Sales invoice not found.");
    if (invoice.status === "CANCELLED") throw new Error("Sales invoice is already cancelled.");
    if (Number(invoice.amount_paid || 0) > EPSILON) {
      throw new Error("This invoice has received payment. Use credit note/refund flow instead of direct cancellation.");
    }

    const creditCount = Number(db.prepare(`
      SELECT COUNT(*) AS count FROM sales_credit_notes
      WHERE sales_invoice_id = ? AND status = 'POSTED'
    `).get(invoice.id)?.count || 0);
    if (creditCount > 0) {
      throw new Error("This invoice already has a credit note. It cannot be cancelled directly.");
    }

    const items = db.prepare(`SELECT * FROM sales_items WHERE sales_invoice_id = ?`).all(invoice.id);
    for (const item of items) {
      const saleCost = db.prepare(`
        SELECT unit_cost FROM stock_transactions
        WHERE reference_type = 'SALE' AND reference_id = ?
          AND item_id = ? AND transaction_type = 'SALE'
        ORDER BY id LIMIT 1
      `).get(invoice.id, item.item_id);
      const originalUnitCost = Number(saleCost?.unit_cost || 0);
      addInventoryValue(item.item_id, Number(item.quantity), originalUnitCost);
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

    db.prepare(`
      UPDATE sales_invoices
      SET status = 'CANCELLED', payment_status = 'CANCELLED', updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(invoice.id);

    return { invoiceId: invoice.id, invoiceNo: invoice.invoice_no, status: "CANCELLED" };
  });

  return transaction();
}
