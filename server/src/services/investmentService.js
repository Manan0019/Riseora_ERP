import db from "../db/database.js";
import { toTitleCase } from "../utils/textFormat.js";

const EPSILON = 0.000001;
const PAYMENT_TYPES = new Set(["PRINCIPAL", "INTEREST"]);

function localToday() {
  const date = new Date();
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function parseIsoDate(value) {
  const text = String(value || "").slice(0, 10);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return date;
}

function isoDate(date) {
  return date.toISOString().slice(0, 10);
}

function daysInUtcMonth(year, monthIndex) {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

function addMonthsClamped(date, months) {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  const day = date.getUTCDate();
  const absoluteMonth = month + months;
  const targetYear = year + Math.floor(absoluteMonth / 12);
  const targetMonth = ((absoluteMonth % 12) + 12) % 12;
  const targetDay = Math.min(day, daysInUtcMonth(targetYear, targetMonth));
  return new Date(Date.UTC(targetYear, targetMonth, targetDay));
}

function periodDueDate(lendDate, periodNumber) {
  const start = parseIsoDate(lendDate);
  if (!start) return null;
  const due = addMonthsClamped(start, periodNumber);
  due.setUTCDate(due.getUTCDate() - 1);
  return isoDate(due);
}

function normalizeInvestment(data) {
  const partyName = toTitleCase(data.partyName || data.party_name);
  const lendDate = String(data.lendDate || data.lend_date || "").trim();
  const amount = Number(data.amount || 0);
  const interestRateMonthly = Number(
    data.interestRateMonthly ?? data.interest_rate_monthly ?? 0,
  );
  const notes = String(data.notes || "").trim() || null;

  if (!partyName) throw new Error("Person / lender name is required.");
  if (!parseIsoDate(lendDate)) throw new Error("A valid borrow date is required.");
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Principal amount must be greater than zero.");
  }
  if (
    !Number.isFinite(interestRateMonthly) ||
    interestRateMonthly < 0 ||
    interestRateMonthly > 100
  ) {
    throw new Error("Monthly interest rate must be between 0 and 100 percent.");
  }

  return { partyName, lendDate, amount, interestRateMonthly, notes };
}

function getRawInvestment(id) {
  return db.prepare(`SELECT * FROM investments WHERE id = ?`).get(Number(id));
}

function getPayments(investmentId) {
  return db.prepare(`
    SELECT *
    FROM investment_payments
    WHERE investment_id = ?
      AND status = 'POSTED'
    ORDER BY payment_date, id
  `).all(Number(investmentId));
}

function principalPaidBeforeDate(payments, dateText) {
  return payments
    .filter(
      (payment) =>
        payment.payment_type === "PRINCIPAL" &&
        String(payment.payment_date) < String(dateText),
    )
    .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
}

function sumPayments(payments, type, asOfDate = null) {
  return payments
    .filter(
      (payment) =>
        payment.payment_type === type &&
        (!asOfDate || String(payment.payment_date) <= String(asOfDate)),
    )
    .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
}

function deriveInvestment(rawInvestment, payments = [], asOfDate = localToday()) {
  const principal = Number(rawInvestment.amount || 0);
  const rate = Number(rawInvestment.interest_rate_monthly || 0);
  const openingInterestDue = Number(rawInvestment.opening_interest_due || 0);

  const principalReturned = sumPayments(payments, "PRINCIPAL", asOfDate);
  const interestPaid = sumPayments(payments, "INTEREST", asOfDate);
  const outstandingPrincipal = Math.max(0, principal - principalReturned);

  let dynamicAccruedInterest = 0;
  let periodsAccrued = 0;
  let nextInterestDate = null;

  if (rate > EPSILON && principal > EPSILON) {
    for (let period = 1; period <= 2400; period += 1) {
      const dueDate = periodDueDate(rawInvestment.lend_date, period);
      if (!dueDate) break;

      const paidBeforeDue = principalPaidBeforeDate(payments, dueDate);
      const principalForPeriod = Math.max(0, principal - paidBeforeDue);

      if (String(dueDate) > String(asOfDate)) {
        if (principalForPeriod > EPSILON) nextInterestDate = dueDate;
        break;
      }

      if (principalForPeriod <= EPSILON) break;

      dynamicAccruedInterest += principalForPeriod * (rate / 100);
      periodsAccrued += 1;
    }
  }

  const accruedInterest = Math.max(0, openingInterestDue + dynamicAccruedInterest);
  const outstandingInterest = Math.max(0, accruedInterest - interestPaid);
  const totalDue = outstandingPrincipal + outstandingInterest;
  const status = totalDue <= EPSILON ? "CLEARED" : "OPEN";

  const paymentsThroughDate = payments.filter(
    (payment) => String(payment.payment_date) <= String(asOfDate),
  );
  const lastPaymentDate = paymentsThroughDate.length
    ? paymentsThroughDate[paymentsThroughDate.length - 1].payment_date
    : null;

  return {
    ...rawInvestment,
    principal_returned: principalReturned,
    interest_paid: interestPaid,
    accrued_interest: accruedInterest,
    dynamic_accrued_interest: dynamicAccruedInterest,
    outstanding_amount: outstandingPrincipal,
    outstanding_interest: outstandingInterest,
    total_due: totalDue,
    interest_periods_accrued: periodsAccrued,
    next_interest_date: nextInterestDate,
    last_payment_date: lastPaymentDate,
    cleared_date: status === "CLEARED" ? lastPaymentDate : null,
    investment_status: status,
    as_of_date: asOfDate,
  };
}

function enrichInvestment(rawInvestment, asOfDate = localToday()) {
  const payments = getPayments(rawInvestment.id);
  return deriveInvestment(rawInvestment, payments, asOfDate);
}

export function getInvestments(includeInactive = false) {
  const rows = db.prepare(`
    SELECT *
    FROM investments
    ${includeInactive ? "" : "WHERE is_active = 1"}
    ORDER BY lend_date DESC, id DESC
  `).all();

  return rows.map((row) => enrichInvestment(row));
}

export function getInvestmentById(id) {
  const raw = getRawInvestment(id);
  return raw ? enrichInvestment(raw) : null;
}

export function getInvestmentDetails(id) {
  const raw = getRawInvestment(id);
  if (!raw) return null;
  const payments = getPayments(id);
  return {
    investment: deriveInvestment(raw, payments),
    payments,
  };
}

export function createInvestment(data) {
  const value = normalizeInvestment(data);

  const result = db.prepare(`
    INSERT INTO investments (
      party_name,
      lend_date,
      amount,
      interest_rate_monthly,
      notes
    ) VALUES (?, ?, ?, ?, ?)
  `).run(
    value.partyName,
    value.lendDate,
    value.amount,
    value.interestRateMonthly,
    value.notes,
  );

  return getInvestmentById(result.lastInsertRowid);
}

export function updateInvestment(id, data) {
  const investmentId = Number(id);
  const existing = getRawInvestment(investmentId);
  if (!existing) throw new Error("Investment entry not found.");

  const value = normalizeInvestment(data);
  const paymentCount = Number(
    db.prepare(`
      SELECT COUNT(*) AS count
      FROM investment_payments
      WHERE investment_id = ? AND status = 'POSTED'
    `).get(investmentId)?.count || 0,
  );

  if (paymentCount > 0) {
    const termsChanged =
      String(value.lendDate) !== String(existing.lend_date) ||
      Math.abs(value.amount - Number(existing.amount || 0)) > EPSILON ||
      Math.abs(value.interestRateMonthly - Number(existing.interest_rate_monthly || 0)) > EPSILON;

    if (termsChanged) {
      throw new Error(
        "Borrow date, principal amount and interest rate cannot be changed after a return/payment has been recorded. Person name and notes can still be edited.",
      );
    }
  }

  db.prepare(`
    UPDATE investments
    SET
      party_name = ?,
      lend_date = ?,
      amount = ?,
      interest_rate_monthly = ?,
      notes = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(
    value.partyName,
    value.lendDate,
    value.amount,
    value.interestRateMonthly,
    value.notes,
    investmentId,
  );

  return getInvestmentById(investmentId);
}

export function addInvestmentPayment(id, data) {
  const investmentId = Number(id);
  const raw = getRawInvestment(investmentId);
  if (!raw) throw new Error("Investment entry not found.");
  if (Number(raw.is_active) !== 1) {
    throw new Error("Payments cannot be recorded against an inactive investment entry.");
  }

  const paymentDate = String(data.paymentDate || data.payment_date || "").trim();
  const paymentType = String(data.paymentType || data.payment_type || "")
    .trim()
    .toUpperCase();
  const amount = Number(data.amount || 0);
  const paymentAccount = String(data.paymentAccount || data.payment_account || "").trim() || null;
  const notes = String(data.notes || "").trim() || null;

  if (!parseIsoDate(paymentDate)) throw new Error("A valid payment / return date is required.");
  if (paymentDate < String(raw.lend_date)) {
    throw new Error("Payment / return date cannot be earlier than the borrow date.");
  }
  if (!PAYMENT_TYPES.has(paymentType)) {
    throw new Error("Pay towards must be Principal or Interest.");
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Payment amount must be greater than zero.");
  }

  const existingPayments = getPayments(investmentId);
  const lastPayment = existingPayments[existingPayments.length - 1];
  if (lastPayment && paymentDate < String(lastPayment.payment_date)) {
    throw new Error(
      `Payment date cannot be earlier than the latest recorded payment (${lastPayment.payment_date}).`,
    );
  }

  const dueAtPaymentDate = deriveInvestment(raw, existingPayments, paymentDate);

  if (paymentType === "PRINCIPAL" && amount > dueAtPaymentDate.outstanding_amount + EPSILON) {
    throw new Error(
      `Principal return cannot exceed principal due of ₹${dueAtPaymentDate.outstanding_amount.toFixed(2)}.`,
    );
  }

  if (paymentType === "INTEREST" && amount > dueAtPaymentDate.outstanding_interest + EPSILON) {
    throw new Error(
      `Interest payment cannot exceed payable interest of ₹${dueAtPaymentDate.outstanding_interest.toFixed(2)} as on ${paymentDate}.`,
    );
  }

  db.prepare(`
    INSERT INTO investment_payments (
      investment_id,
      payment_date,
      payment_type,
      amount,
      payment_account,
      notes
    ) VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    investmentId,
    paymentDate,
    paymentType,
    amount,
    paymentAccount,
    notes,
  );

  return getInvestmentDetails(investmentId);
}

export function deactivateInvestment(id) {
  const investmentId = Number(id);
  if (!getRawInvestment(investmentId)) throw new Error("Investment entry not found.");
  db.prepare(`
    UPDATE investments
    SET is_active = 0, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(investmentId);
  return getInvestmentById(investmentId);
}

export function activateInvestment(id) {
  const investmentId = Number(id);
  if (!getRawInvestment(investmentId)) throw new Error("Investment entry not found.");
  db.prepare(`
    UPDATE investments
    SET is_active = 1, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(investmentId);
  return getInvestmentById(investmentId);
}

export function getInvestmentSummary() {
  const rows = db.prepare(`
    SELECT *
    FROM investments
    WHERE is_active = 1
    ORDER BY id
  `).all();

  const enriched = rows.map((row) => enrichInvestment(row));

  return enriched.reduce(
    (summary, investment) => {
      summary.principalBorrowed += Number(investment.amount || 0);
      summary.principalReturned += Number(investment.principal_returned || 0);
      summary.outstandingPrincipal += Number(investment.outstanding_amount || 0);
      summary.accruedInterest += Number(investment.accrued_interest || 0);
      summary.interestPaid += Number(investment.interest_paid || 0);
      summary.outstandingInterest += Number(investment.outstanding_interest || 0);
      summary.totalDue += Number(investment.total_due || 0);
      if (investment.investment_status === "OPEN") summary.openCount += 1;
      if (investment.investment_status === "CLEARED") summary.clearedCount += 1;
      return summary;
    },
    {
      principalBorrowed: 0,
      principalReturned: 0,
      outstandingPrincipal: 0,
      accruedInterest: 0,
      interestPaid: 0,
      outstandingInterest: 0,
      totalDue: 0,
      openCount: 0,
      clearedCount: 0,
    },
  );
}
