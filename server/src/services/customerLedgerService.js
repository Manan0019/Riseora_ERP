import db from "../db/database.js";

export function getCustomerOutstanding() {
  return db.prepare(`
    SELECT
      c.id AS customer_id,
      c.code AS customer_code,
      c.name AS customer_name,
      c.phone,
      c.customer_type,

      COALESCE(
        SUM(
          CASE
            WHEN si.status = 'POSTED'
            THEN si.grand_total
            ELSE 0
          END
        ),
        0
      ) AS total_sales,

      COALESCE(
        SUM(
          CASE
            WHEN si.status = 'POSTED'
            THEN si.amount_paid
            ELSE 0
          END
        ),
        0
      ) AS total_paid,

      COALESCE(
        SUM(
          CASE
            WHEN si.status = 'POSTED'
            THEN si.grand_total - si.amount_paid
            ELSE 0
          END
        ),
        0
      ) AS outstanding

    FROM customers c

    LEFT JOIN sales_invoices si
      ON si.customer_id = c.id

    WHERE c.is_active = 1

    GROUP BY
      c.id,
      c.code,
      c.name,
      c.phone,
      c.customer_type

    ORDER BY c.name
  `).all();
}

export function getCustomerLedger(customerId) {
  const customer = db.prepare(`
    SELECT
      id,
      code,
      name,
      phone,
      email,
      gstin,
      customer_type,
      credit_days,
      credit_limit

    FROM customers

    WHERE id = ?
  `).get(customerId);

  if (!customer) {
    return null;
  }

  const invoices = db.prepare(`
    SELECT
      id,
      invoice_no,
      invoice_date,
      grand_total,
      amount_paid,
      payment_status,
      status,
      notes

    FROM sales_invoices

    WHERE customer_id = ?

    ORDER BY
      invoice_date,
      id
  `).all(customerId);

  const payments = db.prepare(`
    SELECT
      sp.id,
      sp.sales_invoice_id,
      sp.payment_date,
      sp.amount,
      sp.payment_mode,
      sp.reference_no,
      sp.notes,
      sp.status,

      si.invoice_no

    FROM sales_payments sp

    INNER JOIN sales_invoices si
      ON si.id = sp.sales_invoice_id

    WHERE si.customer_id = ?

    ORDER BY
      sp.payment_date,
      sp.id
  `).all(customerId);

  let totalSales = 0;
  let totalPaid = 0;

  for (const invoice of invoices) {
    if (invoice.status === "POSTED") {
      totalSales +=
        Number(invoice.grand_total || 0);

      totalPaid +=
        Number(invoice.amount_paid || 0);
    }
  }

  const transactions = [];

  for (const invoice of invoices) {
    if (invoice.status !== "POSTED") {
      continue;
    }

    transactions.push({
      id: `INV-${invoice.id}`,
      transactionDate:
        invoice.invoice_date,

      transactionType:
        "INVOICE",

      referenceNo:
        invoice.invoice_no,

      debit:
        Number(
          invoice.grand_total || 0
        ),

      credit: 0,

      notes:
        invoice.notes || null,
    });
  }

  for (const payment of payments) {
    if (payment.status !== "POSTED") {
      continue;
    }

    transactions.push({
      id: `PAY-${payment.id}`,
      transactionDate:
        payment.payment_date,

      transactionType:
        "PAYMENT",

      referenceNo:
        payment.invoice_no,

      debit: 0,

      credit:
        Number(
          payment.amount || 0
        ),

      paymentMode:
        payment.payment_mode,

      paymentReference:
        payment.reference_no,

      notes:
        payment.notes || null,
    });
  }

  transactions.sort((a, b) => {
    if (
      a.transactionDate ===
      b.transactionDate
    ) {
      return String(a.id).localeCompare(
        String(b.id)
      );
    }

    return a.transactionDate.localeCompare(
      b.transactionDate
    );
  });

  let runningBalance = 0;

  const ledger =
    transactions.map(
      (transaction) => {
        runningBalance +=
          Number(
            transaction.debit || 0
          ) -
          Number(
            transaction.credit || 0
          );

        return {
          ...transaction,
          balance:
            runningBalance,
        };
      }
    );

  return {
    customer,

    summary: {
      totalSales,
      totalPaid,
      outstanding:
        totalSales -
        totalPaid,
    },

    invoices,
    payments,
    ledger,
  };
}