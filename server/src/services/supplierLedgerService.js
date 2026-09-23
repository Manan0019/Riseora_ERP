import db from "../db/database.js";
import { getSupplierOpeningBalance } from "./openingBalanceService.js";

const EPSILON = 0.000001;

function getPaymentStatus(grandTotal, amountPaid) {
  if (amountPaid <= EPSILON) return "UNPAID";
  if (amountPaid + EPSILON >= grandTotal) return "PAID";
  return "PARTIAL";
}

function getSupplierFinancialTotals(supplierId) {
  const purchases = db.prepare(`
    SELECT
      COALESCE(SUM(CASE WHEN status = 'POSTED' THEN grand_total ELSE 0 END), 0) AS total_purchases,
      COALESCE(SUM(CASE WHEN status = 'POSTED' THEN amount_paid ELSE 0 END), 0) AS total_paid
    FROM purchases
    WHERE supplier_id = ?
  `).get(Number(supplierId));

  const opening = getSupplierOpeningBalance(Number(supplierId), { includeSettlements: true });
  const openingBalance = Number(opening?.remaining_signed || 0);
  const totalPurchases = Number(purchases?.total_purchases || 0);
  const totalPaid = Number(purchases?.total_paid || 0);

  return {
    openingBalance,
    openingOriginal: Number(opening?.signed_opening || 0),
    openingSettled: Number(opening?.settled_amount || 0),
    openingBalanceType: opening?.balance_type || null,
    openingRemainingType: opening?.remaining_type || "SETTLED",
    totalPurchases,
    totalPaid,
    outstanding: openingBalance + totalPurchases - totalPaid,
  };
}

export function getSupplierOutstanding() {
  const suppliers = db.prepare(`
    SELECT
      s.id AS supplier_id,
      s.code AS supplier_code,
      s.name AS supplier_name,
      s.phone,
      s.is_active
    FROM suppliers s
    ORDER BY s.is_active DESC, s.name
  `).all();

  return suppliers.map((supplier) => {
    const totals = getSupplierFinancialTotals(supplier.supplier_id);
    return {
      ...supplier,
      opening_balance: totals.openingBalance,
      opening_original: totals.openingOriginal,
      opening_settled: totals.openingSettled,
      opening_balance_type: totals.openingBalanceType,
      opening_remaining_type: totals.openingRemainingType,
      total_purchases: totals.totalPurchases,
      total_paid: totals.totalPaid,
      outstanding: totals.outstanding,
    };
  });
}

export function getSupplierLedger(supplierId) {
  const id = Number(supplierId);

  const supplier = db.prepare(`
    SELECT
      id,
      code,
      name,
      contact_person,
      phone,
      email,
      gstin,
      payment_terms_days,
      is_active
    FROM suppliers
    WHERE id = ?
  `).get(id);

  if (!supplier) return null;

  const openingBalance = getSupplierOpeningBalance(id, { includeSettlements: true });

  const purchases = db.prepare(`
    SELECT
      id,
      purchase_no,
      purchase_date,
      due_date,
      payment_terms_days_snapshot,
      grand_total,
      amount_paid,
      payment_status,
      status,
      notes
    FROM purchases
    WHERE supplier_id = ?
    ORDER BY purchase_date, id
  `).all(id);

  const payments = db.prepare(`
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
    INNER JOIN purchases p ON p.id = sp.purchase_id
    WHERE p.supplier_id = ?
    ORDER BY sp.payment_date, sp.id
  `).all(id);

  const transactions = [];

  if (openingBalance && Number(openingBalance.amount || 0) > 0) {
    const openingIsCredit = openingBalance.balance_type === "CREDIT";
    transactions.push({
      id: `OPEN-${openingBalance.id}`,
      transactionDate: openingBalance.opening_date,
      sortOrder: 0,
      transactionType: "OPENING_BALANCE",
      referenceNo: "OPENING",
      debit: openingIsCredit ? 0 : Number(openingBalance.amount || 0),
      credit: openingIsCredit ? Number(openingBalance.amount || 0) : 0,
      notes: openingBalance.notes || null,
    });

    for (const settlement of openingBalance.settlements || []) {
      if (settlement.status !== "POSTED") continue;
      const isPayment = settlement.settlement_type === "PAYMENT";
      transactions.push({
        id: `OPENSET-${settlement.id}`,
        transactionDate: settlement.settlement_date,
        sortOrder: 1,
        transactionType: isPayment ? "OPENING_PAYMENT" : "OPENING_RECEIPT",
        referenceNo: settlement.reference_no || "OPENING",
        debit: isPayment ? Number(settlement.amount || 0) : 0,
        credit: isPayment ? 0 : Number(settlement.amount || 0),
        paymentMode: settlement.payment_mode,
        paymentReference: settlement.reference_no,
        notes: settlement.notes || null,
      });
    }
  }

  for (const purchase of purchases) {
    if (purchase.status !== "POSTED") continue;
    transactions.push({
      id: `PUR-${purchase.id}`,
      transactionDate: purchase.purchase_date,
      sortOrder: 2,
      transactionType: "PURCHASE",
      referenceNo: purchase.purchase_no,
      debit: 0,
      credit: Number(purchase.grand_total || 0),
      notes: purchase.notes || null,
    });
  }

  for (const payment of payments) {
    if (payment.status !== "POSTED") continue;
    transactions.push({
      id: `PAY-${payment.id}`,
      transactionDate: payment.payment_date,
      sortOrder: 3,
      transactionType: "PAYMENT",
      referenceNo: payment.purchase_no,
      debit: Number(payment.amount || 0),
      credit: 0,
      paymentMode: payment.payment_mode,
      paymentReference: payment.reference_no,
      notes: payment.notes || null,
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
    runningBalance += Number(transaction.credit || 0) - Number(transaction.debit || 0);
    return { ...transaction, balance: runningBalance };
  });

  const totals = getSupplierFinancialTotals(id);

  return {
    supplier,
    openingBalance,
    summary: totals,
    purchases,
    payments,
    ledger,
  };
}

export function addSupplierPayment(purchaseId, data) {
  const transaction = db.transaction(() => {
    const purchase = db.prepare(`
      SELECT *
      FROM purchases
      WHERE id = ?
    `).get(Number(purchaseId));

    if (!purchase) throw new Error("Purchase not found.");
    if (purchase.status === "CANCELLED") {
      throw new Error("Payment cannot be added to a cancelled purchase.");
    }

    const paymentAmount = Number(data.amount);
    if (!Number.isFinite(paymentAmount) || paymentAmount <= 0) {
      throw new Error("Payment amount must be greater than zero.");
    }

    if (!data.paymentDate) throw new Error("Payment date is required.");
    if (String(data.paymentDate) < String(purchase.purchase_date)) {
      throw new Error("Payment date cannot be earlier than the purchase date.");
    }

    const balance = Number(purchase.grand_total || 0) - Number(purchase.amount_paid || 0);
    if (paymentAmount > balance + EPSILON) {
      throw new Error(`Payment cannot exceed outstanding balance of ₹${balance.toFixed(2)}.`);
    }

    db.prepare(`
      INSERT INTO supplier_payments (
        purchase_id,
        payment_date,
        amount,
        payment_mode,
        reference_no,
        notes
      ) VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      purchase.id,
      data.paymentDate,
      paymentAmount,
      data.paymentMode || "CASH",
      data.referenceNo || null,
      data.notes || null,
    );

    const newAmountPaid = Number(purchase.amount_paid || 0) + paymentAmount;
    const paymentStatus = getPaymentStatus(Number(purchase.grand_total || 0), newAmountPaid);

    db.prepare(`
      UPDATE purchases
      SET
        amount_paid = ?,
        payment_status = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(newAmountPaid, paymentStatus, purchase.id);

    return {
      purchaseId: purchase.id,
      amountPaid: newAmountPaid,
      balanceAmount: Number(purchase.grand_total || 0) - newAmountPaid,
      paymentStatus,
    };
  });

  return transaction();
}
