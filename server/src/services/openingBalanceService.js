import db from "../db/database.js";

const EPSILON = 0.000001;
const PAYMENT_MODES = new Set(["CASH", "UPI", "BANK", "CARD", "CHEQUE", "OTHER"]);

function validDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || "").trim());
}

function amountValue(value, label, { allowZero = false } = {}) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0 || (!allowZero && amount <= 0)) {
    throw new Error(
      allowZero
        ? `${label} must be a valid non-negative amount.`
        : `${label} must be greater than zero.`,
    );
  }
  return amount;
}

function normalizeMode(value) {
  const mode = String(value || "CASH").trim().toUpperCase();
  return PAYMENT_MODES.has(mode) ? mode : "OTHER";
}

function customerSignedOpening(row) {
  if (!row) return 0;
  const amount = Number(row.amount || 0);
  return row.balance_type === "CREDIT" ? -amount : amount;
}

function customerSettlementEffect(type, amount) {
  return type === "REFUND" ? Number(amount || 0) : -Number(amount || 0);
}

function supplierSignedOpening(row) {
  if (!row) return 0;
  const amount = Number(row.amount || 0);
  return row.balance_type === "DEBIT" ? -amount : amount;
}

function supplierSettlementEffect(type, amount) {
  return type === "RECEIPT" ? Number(amount || 0) : -Number(amount || 0);
}

function balanceLabel(signed, positiveLabel, negativeLabel) {
  if (signed > EPSILON) return positiveLabel;
  if (signed < -EPSILON) return negativeLabel;
  return "SETTLED";
}

function firstCustomerBusinessDate(customerId) {
  return db.prepare(`
    SELECT MIN(transaction_date) AS transaction_date
    FROM (
      SELECT invoice_date AS transaction_date
      FROM sales_invoices
      WHERE customer_id = ? AND status = 'POSTED'

      UNION ALL

      SELECT scn.credit_note_date AS transaction_date
      FROM sales_credit_notes scn
      WHERE scn.customer_id = ? AND scn.status = 'POSTED'

      UNION ALL

      SELECT sr.refund_date AS transaction_date
      FROM sales_refunds sr
      WHERE sr.customer_id = ? AND sr.status = 'POSTED'
    )
  `).get(customerId, customerId, customerId)?.transaction_date || null;
}

function firstSupplierBusinessDate(supplierId) {
  return db.prepare(`
    SELECT MIN(purchase_date) AS transaction_date
    FROM purchases
    WHERE supplier_id = ? AND status = 'POSTED'
  `).get(supplierId)?.transaction_date || null;
}

export function getCustomerOpeningBalance(customerId, { includeSettlements = true } = {}) {
  const row = db.prepare(`
    SELECT *
    FROM customer_opening_balances
    WHERE customer_id = ?
  `).get(Number(customerId));

  if (!row) return null;

  const settlements = includeSettlements
    ? db.prepare(`
        SELECT *
        FROM customer_opening_balance_settlements
        WHERE customer_id = ? AND status = 'POSTED'
        ORDER BY settlement_date, id
      `).all(Number(customerId))
    : [];

  const settlementEffect = settlements.reduce(
    (total, entry) => total + customerSettlementEffect(entry.settlement_type, entry.amount),
    0,
  );
  const signedOpening = customerSignedOpening(row);
  const remainingSigned = signedOpening + settlementEffect;

  return {
    ...row,
    signed_opening: signedOpening,
    settlement_effect: settlementEffect,
    settled_amount: settlements.reduce((total, entry) => total + Number(entry.amount || 0), 0),
    remaining_signed: Math.abs(remainingSigned) < EPSILON ? 0 : remainingSigned,
    remaining_amount: Math.abs(remainingSigned) < EPSILON ? 0 : Math.abs(remainingSigned),
    remaining_type: balanceLabel(remainingSigned, "RECEIVABLE", "CUSTOMER_ADVANCE"),
    settlements,
  };
}

export function getSupplierOpeningBalance(supplierId, { includeSettlements = true } = {}) {
  const row = db.prepare(`
    SELECT *
    FROM supplier_opening_balances
    WHERE supplier_id = ?
  `).get(Number(supplierId));

  if (!row) return null;

  const settlements = includeSettlements
    ? db.prepare(`
        SELECT *
        FROM supplier_opening_balance_settlements
        WHERE supplier_id = ? AND status = 'POSTED'
        ORDER BY settlement_date, id
      `).all(Number(supplierId))
    : [];

  const settlementEffect = settlements.reduce(
    (total, entry) => total + supplierSettlementEffect(entry.settlement_type, entry.amount),
    0,
  );
  const signedOpening = supplierSignedOpening(row);
  const remainingSigned = signedOpening + settlementEffect;

  return {
    ...row,
    signed_opening: signedOpening,
    settlement_effect: settlementEffect,
    settled_amount: settlements.reduce((total, entry) => total + Number(entry.amount || 0), 0),
    remaining_signed: Math.abs(remainingSigned) < EPSILON ? 0 : remainingSigned,
    remaining_amount: Math.abs(remainingSigned) < EPSILON ? 0 : Math.abs(remainingSigned),
    remaining_type: balanceLabel(remainingSigned, "PAYABLE", "SUPPLIER_ADVANCE"),
    settlements,
  };
}

export function getOpeningBalanceSetup() {
  const customers = db.prepare(`
    SELECT id, code, name, is_active
    FROM customers
    ORDER BY is_active DESC, name
  `).all().map((customer) => ({
    ...customer,
    opening_balance: getCustomerOpeningBalance(customer.id, { includeSettlements: true }),
  }));

  const suppliers = db.prepare(`
    SELECT id, code, name, is_active
    FROM suppliers
    ORDER BY is_active DESC, name
  `).all().map((supplier) => ({
    ...supplier,
    opening_balance: getSupplierOpeningBalance(supplier.id, { includeSettlements: true }),
  }));

  return { customers, suppliers };
}

export function saveCustomerOpeningBalance(customerId, data) {
  const id = Number(customerId);
  const customer = db.prepare(`SELECT id, code, name FROM customers WHERE id = ?`).get(id);
  if (!customer) throw new Error("Customer not found.");

  const openingDate = String(data.openingDate || "").trim();
  if (!validDate(openingDate)) throw new Error("A valid opening date is required.");

  const balanceType = String(data.balanceType || "").trim().toUpperCase();
  if (!new Set(["DEBIT", "CREDIT"]).has(balanceType)) {
    throw new Error("Customer opening balance type must be DEBIT or CREDIT.");
  }

  const amount = amountValue(data.amount || 0, "Opening balance", { allowZero: true });
  const existing = getCustomerOpeningBalance(id, { includeSettlements: true });

  if (existing?.settlements?.length) {
    if (existing.balance_type !== balanceType) {
      throw new Error("Opening balance type cannot be changed after an opening-balance settlement has been recorded.");
    }
    if (amount + EPSILON < Number(existing.settled_amount || 0)) {
      throw new Error("Opening balance cannot be reduced below the amount already settled.");
    }

    const signedNewOpening = balanceType === "CREDIT" ? -amount : amount;
    const remaining = signedNewOpening + Number(existing.settlement_effect || 0);
    if (
      (signedNewOpening > EPSILON && remaining < -EPSILON) ||
      (signedNewOpening < -EPSILON && remaining > EPSILON)
    ) {
      throw new Error("Opening balance cannot be reduced below the amount already settled.");
    }

    const firstSettlementDate = existing.settlements[0]?.settlement_date;
    if (firstSettlementDate && openingDate > firstSettlementDate) {
      throw new Error("Opening date cannot be later than an existing opening-balance settlement.");
    }
  }

  const firstBusinessDate = firstCustomerBusinessDate(id);
  if (firstBusinessDate && openingDate > firstBusinessDate) {
    throw new Error(`Opening date must be on or before the customer's first posted transaction (${firstBusinessDate}).`);
  }

  db.prepare(`
    INSERT INTO customer_opening_balances (
      customer_id, opening_date, balance_type, amount, notes
    ) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(customer_id) DO UPDATE SET
      opening_date = excluded.opening_date,
      balance_type = excluded.balance_type,
      amount = excluded.amount,
      notes = excluded.notes,
      updated_at = CURRENT_TIMESTAMP
  `).run(id, openingDate, balanceType, amount, data.notes?.trim() || null);

  return getCustomerOpeningBalance(id, { includeSettlements: true });
}

export function saveSupplierOpeningBalance(supplierId, data) {
  const id = Number(supplierId);
  const supplier = db.prepare(`SELECT id, code, name FROM suppliers WHERE id = ?`).get(id);
  if (!supplier) throw new Error("Supplier not found.");

  const openingDate = String(data.openingDate || "").trim();
  if (!validDate(openingDate)) throw new Error("A valid opening date is required.");

  const balanceType = String(data.balanceType || "").trim().toUpperCase();
  if (!new Set(["DEBIT", "CREDIT"]).has(balanceType)) {
    throw new Error("Supplier opening balance type must be DEBIT or CREDIT.");
  }

  const amount = amountValue(data.amount || 0, "Opening balance", { allowZero: true });
  const existing = getSupplierOpeningBalance(id, { includeSettlements: true });

  if (existing?.settlements?.length) {
    if (existing.balance_type !== balanceType) {
      throw new Error("Opening balance type cannot be changed after an opening-balance settlement has been recorded.");
    }
    if (amount + EPSILON < Number(existing.settled_amount || 0)) {
      throw new Error("Opening balance cannot be reduced below the amount already settled.");
    }

    const signedNewOpening = balanceType === "DEBIT" ? -amount : amount;
    const remaining = signedNewOpening + Number(existing.settlement_effect || 0);
    if (
      (signedNewOpening > EPSILON && remaining < -EPSILON) ||
      (signedNewOpening < -EPSILON && remaining > EPSILON)
    ) {
      throw new Error("Opening balance cannot be reduced below the amount already settled.");
    }

    const firstSettlementDate = existing.settlements[0]?.settlement_date;
    if (firstSettlementDate && openingDate > firstSettlementDate) {
      throw new Error("Opening date cannot be later than an existing opening-balance settlement.");
    }
  }

  const firstBusinessDate = firstSupplierBusinessDate(id);
  if (firstBusinessDate && openingDate > firstBusinessDate) {
    throw new Error(`Opening date must be on or before the supplier's first posted transaction (${firstBusinessDate}).`);
  }

  db.prepare(`
    INSERT INTO supplier_opening_balances (
      supplier_id, opening_date, balance_type, amount, notes
    ) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(supplier_id) DO UPDATE SET
      opening_date = excluded.opening_date,
      balance_type = excluded.balance_type,
      amount = excluded.amount,
      notes = excluded.notes,
      updated_at = CURRENT_TIMESTAMP
  `).run(id, openingDate, balanceType, amount, data.notes?.trim() || null);

  return getSupplierOpeningBalance(id, { includeSettlements: true });
}

export function addCustomerOpeningSettlement(customerId, data) {
  const transaction = db.transaction(() => {
    const opening = getCustomerOpeningBalance(customerId, { includeSettlements: true });
    if (!opening || Number(opening.amount || 0) <= EPSILON) {
      throw new Error("This customer does not have an opening balance to settle.");
    }

    const settlementDate = String(data.settlementDate || "").trim();
    if (!validDate(settlementDate)) throw new Error("A valid settlement date is required.");
    if (settlementDate < opening.opening_date) {
      throw new Error("Settlement date cannot be earlier than the opening balance date.");
    }

    const remaining = Number(opening.remaining_signed || 0);
    if (Math.abs(remaining) <= EPSILON) throw new Error("The customer opening balance is already fully settled.");

    const requiredType = remaining > 0 ? "RECEIPT" : "REFUND";
    const requestedType = String(data.settlementType || requiredType).trim().toUpperCase();
    if (requestedType !== requiredType) {
      throw new Error(
        remaining > 0
          ? "This opening balance is receivable. Record a receipt from the customer."
          : "This customer has an opening credit/advance. Record a refund to the customer.",
      );
    }

    const amount = amountValue(data.amount, "Settlement amount");
    if (amount > Math.abs(remaining) + EPSILON) {
      throw new Error(`Settlement cannot exceed the remaining opening balance of ₹${Math.abs(remaining).toFixed(2)}.`);
    }

    const result = db.prepare(`
      INSERT INTO customer_opening_balance_settlements (
        customer_opening_balance_id, customer_id, settlement_date,
        settlement_type, amount, payment_mode, reference_no, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      opening.id,
      Number(customerId),
      settlementDate,
      requiredType,
      amount,
      normalizeMode(data.paymentMode),
      data.referenceNo?.trim() || null,
      data.notes?.trim() || null,
    );

    return {
      settlementId: Number(result.lastInsertRowid),
      openingBalance: getCustomerOpeningBalance(customerId, { includeSettlements: true }),
    };
  });

  return transaction();
}

export function addSupplierOpeningSettlement(supplierId, data) {
  const transaction = db.transaction(() => {
    const opening = getSupplierOpeningBalance(supplierId, { includeSettlements: true });
    if (!opening || Number(opening.amount || 0) <= EPSILON) {
      throw new Error("This supplier does not have an opening balance to settle.");
    }

    const settlementDate = String(data.settlementDate || "").trim();
    if (!validDate(settlementDate)) throw new Error("A valid settlement date is required.");
    if (settlementDate < opening.opening_date) {
      throw new Error("Settlement date cannot be earlier than the opening balance date.");
    }

    const remaining = Number(opening.remaining_signed || 0);
    if (Math.abs(remaining) <= EPSILON) throw new Error("The supplier opening balance is already fully settled.");

    const requiredType = remaining > 0 ? "PAYMENT" : "RECEIPT";
    const requestedType = String(data.settlementType || requiredType).trim().toUpperCase();
    if (requestedType !== requiredType) {
      throw new Error(
        remaining > 0
          ? "This opening balance is payable. Record a payment to the supplier."
          : "This supplier has an opening advance/debit. Record a receipt from the supplier.",
      );
    }

    const amount = amountValue(data.amount, "Settlement amount");
    if (amount > Math.abs(remaining) + EPSILON) {
      throw new Error(`Settlement cannot exceed the remaining opening balance of ₹${Math.abs(remaining).toFixed(2)}.`);
    }

    const result = db.prepare(`
      INSERT INTO supplier_opening_balance_settlements (
        supplier_opening_balance_id, supplier_id, settlement_date,
        settlement_type, amount, payment_mode, reference_no, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      opening.id,
      Number(supplierId),
      settlementDate,
      requiredType,
      amount,
      normalizeMode(data.paymentMode),
      data.referenceNo?.trim() || null,
      data.notes?.trim() || null,
    );

    return {
      settlementId: Number(result.lastInsertRowid),
      openingBalance: getSupplierOpeningBalance(supplierId, { includeSettlements: true }),
    };
  });

  return transaction();
}
