import db from "../db/database.js";

function getCustomerFinancialTotals(customerId = null) {
  const customerFilter = customerId == null ? "" : "AND si.customer_id = ?";
  const args = customerId == null ? [] : [Number(customerId)];

  const sales = db.prepare(`
    SELECT COALESCE(SUM(si.grand_total), 0) AS total
    FROM sales_invoices si
    WHERE si.status = 'POSTED' ${customerFilter}
  `).get(...args);

  const payments = db.prepare(`
    SELECT COALESCE(SUM(sp.amount), 0) AS total
    FROM sales_payments sp
    INNER JOIN sales_invoices si ON si.id = sp.sales_invoice_id
    WHERE sp.status = 'POSTED' AND si.status = 'POSTED' ${customerFilter}
  `).get(...args);

  const credits = db.prepare(`
    SELECT COALESCE(SUM(scn.grand_total), 0) AS total
    FROM sales_credit_notes scn
    INNER JOIN sales_invoices si ON si.id = scn.sales_invoice_id
    WHERE scn.status = 'POSTED' AND si.status = 'POSTED' ${customerFilter}
  `).get(...args);

  const refunds = db.prepare(`
    SELECT COALESCE(SUM(sr.amount), 0) AS total
    FROM sales_refunds sr
    INNER JOIN sales_invoices si ON si.id = sr.sales_invoice_id
    WHERE sr.status = 'POSTED' AND si.status = 'POSTED' ${customerFilter}
  `).get(...args);

  const totalSales = Number(sales?.total || 0);
  const totalPayments = Number(payments?.total || 0);
  const totalCredits = Number(credits?.total || 0);
  const totalRefunds = Number(refunds?.total || 0);
  const netSales = totalSales - totalCredits;
  const netPaid = totalPayments - totalRefunds;
  const outstanding = netSales - netPaid;

  return {
    totalSales,
    totalPayments,
    totalCredits,
    totalRefunds,
    netSales,
    netPaid,
    outstanding,
  };
}

export function getCustomerOutstanding() {
  const customers = db.prepare(`
    SELECT
      c.id AS customer_id,
      c.code AS customer_code,
      c.name AS customer_name,
      c.phone,
      c.customer_type
    FROM customers c
    WHERE c.is_active = 1
    ORDER BY c.name
  `).all();

  return customers.map((customer) => {
    const totals = getCustomerFinancialTotals(customer.customer_id);
    return {
      ...customer,
      total_sales: totals.netSales,
      total_paid: totals.netPaid,
      total_credits: totals.totalCredits,
      total_refunds: totals.totalRefunds,
      outstanding: totals.outstanding,
    };
  });
}

export function getCustomerLedger(customerId) {
  const customer = db.prepare(`
    SELECT
      id, code, name, phone, email, gstin,
      customer_type, credit_days, credit_limit
    FROM customers
    WHERE id = ?
  `).get(Number(customerId));

  if (!customer) return null;

  const invoices = db.prepare(`
    SELECT
      si.id,
      si.invoice_no,
      si.invoice_date,
      si.grand_total,
      si.amount_paid,
      si.payment_status,
      si.status,
      si.notes,
      COALESCE((
        SELECT SUM(scn.grand_total)
        FROM sales_credit_notes scn
        WHERE scn.sales_invoice_id = si.id AND scn.status = 'POSTED'
      ), 0) AS credited_amount,
      COALESCE((
        SELECT SUM(sr.amount)
        FROM sales_refunds sr
        WHERE sr.sales_invoice_id = si.id AND sr.status = 'POSTED'
      ), 0) AS refunded_amount
    FROM sales_invoices si
    WHERE si.customer_id = ?
    ORDER BY si.invoice_date, si.id
  `).all(customer.id).map((invoice) => {
    const effectiveTotal = invoice.status === "POSTED"
      ? Math.max(0, Number(invoice.grand_total || 0) - Number(invoice.credited_amount || 0))
      : 0;
    const netPaid = invoice.status === "POSTED"
      ? Math.max(0, Number(invoice.amount_paid || 0) - Number(invoice.refunded_amount || 0))
      : 0;
    return {
      ...invoice,
      effective_total: effectiveTotal,
      net_paid: netPaid,
      balance_amount: effectiveTotal - netPaid,
    };
  });

  const payments = db.prepare(`
    SELECT
      sp.id, sp.sales_invoice_id, sp.payment_date, sp.amount,
      sp.payment_mode, sp.reference_no, sp.notes, sp.status,
      si.invoice_no
    FROM sales_payments sp
    INNER JOIN sales_invoices si ON si.id = sp.sales_invoice_id
    WHERE si.customer_id = ?
    ORDER BY sp.payment_date, sp.id
  `).all(customer.id);

  const creditNotes = db.prepare(`
    SELECT
      scn.id, scn.credit_note_no, scn.credit_note_date,
      scn.sales_invoice_id, scn.grand_total, scn.reason,
      scn.notes, scn.status, si.invoice_no
    FROM sales_credit_notes scn
    INNER JOIN sales_invoices si ON si.id = scn.sales_invoice_id
    WHERE scn.customer_id = ?
    ORDER BY scn.credit_note_date, scn.id
  `).all(customer.id);

  const refunds = db.prepare(`
    SELECT
      sr.id, sr.refund_no, sr.refund_date,
      sr.sales_invoice_id, sr.amount, sr.refund_mode,
      sr.reference_no, sr.notes, sr.status, si.invoice_no
    FROM sales_refunds sr
    INNER JOIN sales_invoices si ON si.id = sr.sales_invoice_id
    WHERE sr.customer_id = ?
    ORDER BY sr.refund_date, sr.id
  `).all(customer.id);

  const transactions = [];

  for (const invoice of invoices) {
    if (invoice.status !== "POSTED") continue;
    transactions.push({
      id: `INV-${invoice.id}`,
      transactionDate: invoice.invoice_date,
      sortOrder: 1,
      transactionType: "INVOICE",
      referenceNo: invoice.invoice_no,
      debit: Number(invoice.grand_total || 0),
      credit: 0,
      notes: invoice.notes || null,
    });
  }

  for (const payment of payments) {
    if (payment.status !== "POSTED") continue;
    transactions.push({
      id: `PAY-${payment.id}`,
      transactionDate: payment.payment_date,
      sortOrder: 2,
      transactionType: "PAYMENT",
      referenceNo: payment.invoice_no,
      debit: 0,
      credit: Number(payment.amount || 0),
      paymentMode: payment.payment_mode,
      paymentReference: payment.reference_no,
      notes: payment.notes || null,
    });
  }

  for (const creditNote of creditNotes) {
    if (creditNote.status !== "POSTED") continue;
    transactions.push({
      id: `CN-${creditNote.id}`,
      transactionDate: creditNote.credit_note_date,
      sortOrder: 3,
      transactionType: "CREDIT_NOTE",
      referenceNo: creditNote.credit_note_no,
      debit: 0,
      credit: Number(creditNote.grand_total || 0),
      notes: creditNote.reason || creditNote.notes || null,
    });
  }

  for (const refund of refunds) {
    if (refund.status !== "POSTED") continue;
    transactions.push({
      id: `REF-${refund.id}`,
      transactionDate: refund.refund_date,
      sortOrder: 4,
      transactionType: "REFUND",
      referenceNo: refund.refund_no,
      debit: Number(refund.amount || 0),
      credit: 0,
      paymentMode: refund.refund_mode,
      paymentReference: refund.reference_no,
      notes: refund.notes || null,
    });
  }

  transactions.sort((a, b) => {
    if (a.transactionDate === b.transactionDate) {
      if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
      return String(a.id).localeCompare(String(b.id));
    }
    return a.transactionDate.localeCompare(b.transactionDate);
  });

  let runningBalance = 0;
  const ledger = transactions.map((transaction) => {
    runningBalance += Number(transaction.debit || 0) - Number(transaction.credit || 0);
    return { ...transaction, balance: runningBalance };
  });

  const totals = getCustomerFinancialTotals(customer.id);

  return {
    customer,
    summary: totals,
    invoices,
    payments,
    creditNotes,
    refunds,
    ledger,
  };
}
