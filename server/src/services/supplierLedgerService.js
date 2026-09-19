import db from "../db/database.js";

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

export function getSupplierOutstanding() {
  return db.prepare(`
    SELECT
      s.id AS supplier_id,
      s.code AS supplier_code,
      s.name AS supplier_name,
      s.phone,

      COALESCE(
        SUM(
          CASE
            WHEN p.status = 'POSTED'
            THEN p.grand_total
            ELSE 0
          END
        ),
        0
      ) AS total_purchases,

      COALESCE(
        SUM(
          CASE
            WHEN p.status = 'POSTED'
            THEN p.amount_paid
            ELSE 0
          END
        ),
        0
      ) AS total_paid,

      COALESCE(
        SUM(
          CASE
            WHEN p.status = 'POSTED'
            THEN p.grand_total - p.amount_paid
            ELSE 0
          END
        ),
        0
      ) AS outstanding

    FROM suppliers s

    LEFT JOIN purchases p
      ON p.supplier_id = s.id

    WHERE s.is_active = 1

    GROUP BY
      s.id,
      s.code,
      s.name,
      s.phone

    ORDER BY s.name
  `).all();
}

export function getSupplierLedger(
  supplierId
) {
  const supplier =
    db.prepare(`
      SELECT
        id,
        code,
        name,
        contact_person,
        phone,
        email,
        gstin,
        payment_terms_days

      FROM suppliers

      WHERE id = ?
    `).get(supplierId);

  if (!supplier) {
    return null;
  }

  const purchases =
    db.prepare(`
      SELECT
        id,
        purchase_no,
        purchase_date,
        grand_total,
        amount_paid,
        payment_status,
        status,
        notes

      FROM purchases

      WHERE supplier_id = ?

      ORDER BY
        purchase_date,
        id
    `).all(supplierId);

  const payments =
    db.prepare(`
      SELECT
        sp.id,
        sp.purchase_id,
        sp.payment_date,
        sp.amount,
        sp.payment_mode,
        sp.reference_no,
        sp.notes,
        sp.status,

        p.purchase_no

      FROM supplier_payments sp

      INNER JOIN purchases p
        ON p.id = sp.purchase_id

      WHERE p.supplier_id = ?

      ORDER BY
        sp.payment_date,
        sp.id
    `).all(supplierId);

  let totalPurchases = 0;
  let totalPaid = 0;

  for (const purchase of purchases) {
    if (
      purchase.status === "POSTED"
    ) {
      totalPurchases +=
        Number(
          purchase.grand_total || 0
        );

      totalPaid +=
        Number(
          purchase.amount_paid || 0
        );
    }
  }

  const transactions = [];

  for (const purchase of purchases) {
    if (
      purchase.status !== "POSTED"
    ) {
      continue;
    }

    transactions.push({
      id:
        `PUR-${purchase.id}`,

      transactionDate:
        purchase.purchase_date,

      transactionType:
        "PURCHASE",

      referenceNo:
        purchase.purchase_no,

      debit: 0,

      credit:
        Number(
          purchase.grand_total || 0
        ),

      notes:
        purchase.notes || null,
    });
  }

  for (const payment of payments) {
    if (
      payment.status !== "POSTED"
    ) {
      continue;
    }

    transactions.push({
      id:
        `PAY-${payment.id}`,

      transactionDate:
        payment.payment_date,

      transactionType:
        "PAYMENT",

      referenceNo:
        payment.purchase_no,

      debit:
        Number(
          payment.amount || 0
        ),

      credit: 0,

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
      return String(
        a.id
      ).localeCompare(
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
            transaction.credit || 0
          ) -
          Number(
            transaction.debit || 0
          );

        return {
          ...transaction,
          balance:
            runningBalance,
        };
      }
    );

  return {
    supplier,

    summary: {
      totalPurchases,
      totalPaid,
      outstanding:
        totalPurchases -
        totalPaid,
    },

    purchases,
    payments,
    ledger,
  };
}

export function addSupplierPayment(
  purchaseId,
  data
) {
  const transaction =
    db.transaction(() => {
      const purchase =
        db.prepare(`
          SELECT *
          FROM purchases
          WHERE id = ?
        `).get(purchaseId);

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
          "Payment cannot be added to a cancelled purchase."
        );
      }

      const paymentAmount =
        Number(data.amount);

      if (
        paymentAmount <= 0
      ) {
        throw new Error(
          "Payment amount must be greater than zero."
        );
      }

      const balance =
        Number(
          purchase.grand_total
        ) -
        Number(
          purchase.amount_paid || 0
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
        INSERT INTO supplier_payments (
          purchase_id,
          payment_date,
          amount,
          payment_mode,
          reference_no,
          notes
        )
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        purchaseId,
        data.paymentDate,
        paymentAmount,
        data.paymentMode || "CASH",
        data.referenceNo || null,
        data.notes || null
      );

      const newAmountPaid =
        Number(
          purchase.amount_paid || 0
        ) +
        paymentAmount;

      const paymentStatus =
        getPaymentStatus(
          Number(
            purchase.grand_total
          ),
          newAmountPaid
        );

      db.prepare(`
        UPDATE purchases
        SET
          amount_paid = ?,
          payment_status = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(
        newAmountPaid,
        paymentStatus,
        purchaseId
      );

      return {
        purchaseId,
        amountPaid:
          newAmountPaid,
        balanceAmount:
          Number(
            purchase.grand_total
          ) -
          newAmountPaid,
        paymentStatus,
      };
    });

  return transaction();
}