import db from "../database.js";

function hasColumn(tableName, columnName) {
  return db
    .prepare(`PRAGMA table_info(${tableName})`)
    .all()
    .some((column) => column.name === columnName);
}

export function runInvestmentSimpleInterestMigration() {
  let addedOpeningInterestDue = false;

  if (!hasColumn("investments", "interest_rate_monthly")) {
    db.exec(`
      ALTER TABLE investments
      ADD COLUMN interest_rate_monthly REAL NOT NULL DEFAULT 0;
    `);
  }

  if (!hasColumn("investments", "opening_interest_due")) {
    db.exec(`
      ALTER TABLE investments
      ADD COLUMN opening_interest_due REAL NOT NULL DEFAULT 0;
    `);
    addedOpeningInterestDue = true;
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS investment_payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      investment_id INTEGER NOT NULL,
      payment_date TEXT NOT NULL,
      payment_type TEXT NOT NULL,
      amount REAL NOT NULL,
      payment_account TEXT,
      notes TEXT,
      source_ref TEXT UNIQUE,
      status TEXT NOT NULL DEFAULT 'POSTED',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (investment_id) REFERENCES investments(id)
    );

    CREATE INDEX IF NOT EXISTS idx_investment_payments_investment
      ON investment_payments(investment_id, payment_date, id);
  `);

  /*
   * V1.1 initially stored a manually-entered fixed interest amount and
   * cumulative principal/interest returns directly on the investment row.
   * Preserve any such data when upgrading to the payment-history model.
   */
  if (addedOpeningInterestDue && hasColumn("investments", "interest_amount")) {
    db.exec(`
      UPDATE investments
      SET opening_interest_due = CASE
        WHEN COALESCE(interest_amount, 0) > 0 THEN interest_amount
        ELSE 0
      END;
    `);
  }

  if (hasColumn("investments", "principal_returned")) {
    db.exec(`
      INSERT OR IGNORE INTO investment_payments (
        investment_id,
        payment_date,
        payment_type,
        amount,
        payment_account,
        notes,
        source_ref
      )
      SELECT
        id,
        COALESCE(NULLIF(return_date, ''), lend_date),
        'PRINCIPAL',
        principal_returned,
        NULL,
        'Migrated from V1.1 principal returned total',
        'LEGACY-PRINCIPAL-' || id
      FROM investments
      WHERE COALESCE(principal_returned, 0) > 0;
    `);
  }

  if (hasColumn("investments", "interest_paid")) {
    db.exec(`
      INSERT OR IGNORE INTO investment_payments (
        investment_id,
        payment_date,
        payment_type,
        amount,
        payment_account,
        notes,
        source_ref
      )
      SELECT
        id,
        COALESCE(NULLIF(return_date, ''), lend_date),
        'INTEREST',
        interest_paid,
        NULL,
        'Migrated from V1.1 interest paid total',
        'LEGACY-INTEREST-' || id
      FROM investments
      WHERE COALESCE(interest_paid, 0) > 0;
    `);
  }

  console.log("Investment simple-interest/payment-history migration completed");
}
