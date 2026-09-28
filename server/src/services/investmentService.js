import db from "../db/database.js";
import { toTitleCase } from "../utils/textFormat.js";

function normalize(data) {
  const partyName = toTitleCase(data.partyName || data.party_name);
  const lendDate = String(data.lendDate || data.lend_date || "").trim();
  const returnDate = String(data.returnDate || data.return_date || "").trim() || null;
  const amount = Number(data.amount || 0);
  const interestAmount = Number(data.interestAmount || data.interest_amount || 0);
  const principalReturned = Number(data.principalReturned || data.principal_returned || 0);
  const interestPaid = Number(data.interestPaid || data.interest_paid || 0);
  const notes = String(data.notes || "").trim() || null;

  if (!partyName) throw new Error("Party / person name is required.");
  if (!lendDate) throw new Error("Lend date is required.");
  if (!Number.isFinite(amount) || amount <= 0) throw new Error("Investment amount must be greater than zero.");
  if (!Number.isFinite(interestAmount) || interestAmount < 0) throw new Error("Interest amount cannot be negative.");
  if (!Number.isFinite(principalReturned) || principalReturned < 0) throw new Error("Principal returned cannot be negative.");
  if (!Number.isFinite(interestPaid) || interestPaid < 0) throw new Error("Interest paid cannot be negative.");
  if (principalReturned > amount + 0.000001) throw new Error("Principal returned cannot exceed the investment amount.");
  if (interestPaid > interestAmount + 0.000001) throw new Error("Interest paid cannot exceed the interest amount.");
  if (returnDate && returnDate < lendDate) throw new Error("Return date cannot be earlier than lend date.");

  return { partyName, lendDate, returnDate, amount, interestAmount, principalReturned, interestPaid, notes };
}

function selectSql(where = "") {
  return `
    SELECT
      i.*,
      MAX(i.amount - i.principal_returned, 0) AS outstanding_amount,
      MAX(i.interest_amount - i.interest_paid, 0) AS outstanding_interest,
      CASE
        WHEN (i.amount - i.principal_returned) <= 0.000001
         AND (i.interest_amount - i.interest_paid) <= 0.000001
        THEN 'CLOSED'
        ELSE 'OPEN'
      END AS investment_status
    FROM investments i
    ${where}
  `;
}

export function getInvestments(includeInactive = false) {
  const where = includeInactive ? "" : "WHERE i.is_active = 1";
  return db.prepare(`${selectSql(where)} ORDER BY i.lend_date DESC, i.id DESC`).all();
}

export function getInvestmentById(id) {
  return db.prepare(selectSql("WHERE i.id = ?")).get(Number(id));
}

export function createInvestment(data) {
  const value = normalize(data);
  const result = db.prepare(`
    INSERT INTO investments (
      party_name, lend_date, return_date, amount, interest_amount,
      principal_returned, interest_paid, notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    value.partyName,
    value.lendDate,
    value.returnDate,
    value.amount,
    value.interestAmount,
    value.principalReturned,
    value.interestPaid,
    value.notes,
  );
  return getInvestmentById(result.lastInsertRowid);
}

export function updateInvestment(id, data) {
  const investmentId = Number(id);
  if (!getInvestmentById(investmentId)) throw new Error("Investment entry not found.");
  const value = normalize(data);

  db.prepare(`
    UPDATE investments
    SET party_name = ?, lend_date = ?, return_date = ?, amount = ?,
        interest_amount = ?, principal_returned = ?, interest_paid = ?,
        notes = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(
    value.partyName,
    value.lendDate,
    value.returnDate,
    value.amount,
    value.interestAmount,
    value.principalReturned,
    value.interestPaid,
    value.notes,
    investmentId,
  );
  return getInvestmentById(investmentId);
}

export function deactivateInvestment(id) {
  const investmentId = Number(id);
  if (!getInvestmentById(investmentId)) throw new Error("Investment entry not found.");
  db.prepare(`UPDATE investments SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(investmentId);
  return getInvestmentById(investmentId);
}

export function activateInvestment(id) {
  const investmentId = Number(id);
  if (!getInvestmentById(investmentId)) throw new Error("Investment entry not found.");
  db.prepare(`UPDATE investments SET is_active = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(investmentId);
  return getInvestmentById(investmentId);
}

export function getInvestmentSummary() {
  const row = db.prepare(`
    SELECT
      COALESCE(SUM(CASE WHEN is_active = 1 THEN amount ELSE 0 END), 0) AS invested,
      COALESCE(SUM(CASE WHEN is_active = 1 THEN principal_returned ELSE 0 END), 0) AS principal_returned,
      COALESCE(SUM(CASE WHEN is_active = 1 THEN interest_amount ELSE 0 END), 0) AS interest_amount,
      COALESCE(SUM(CASE WHEN is_active = 1 THEN interest_paid ELSE 0 END), 0) AS interest_paid
    FROM investments
  `).get();

  const invested = Number(row?.invested || 0);
  const principalReturned = Number(row?.principal_returned || 0);
  const interestAmount = Number(row?.interest_amount || 0);
  const interestPaid = Number(row?.interest_paid || 0);

  return {
    invested,
    principalReturned,
    outstandingPrincipal: invested - principalReturned,
    interestAmount,
    interestPaid,
    outstandingInterest: interestAmount - interestPaid,
  };
}
