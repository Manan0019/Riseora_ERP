import db from "../database.js";

function hasColumn(tableName, columnName) {
  return db
    .prepare(`PRAGMA table_info(${tableName})`)
    .all()
    .some((column) => column.name === columnName);
}

export function runOwnerFeedbackV11Migration() {
  if (!hasColumn("purchases", "payment_date")) {
    db.exec(`ALTER TABLE purchases ADD COLUMN payment_date TEXT;`);
  }

  if (!hasColumn("purchases", "payment_account")) {
    db.exec(`ALTER TABLE purchases ADD COLUMN payment_account TEXT;`);
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS investments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      party_name TEXT NOT NULL,
      lend_date TEXT NOT NULL,
      return_date TEXT,
      amount REAL NOT NULL,
      interest_amount REAL NOT NULL DEFAULT 0,
      principal_returned REAL NOT NULL DEFAULT 0,
      interest_paid REAL NOT NULL DEFAULT 0,
      notes TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_investments_lend_date
      ON investments(lend_date);

    CREATE TABLE IF NOT EXISTS upad_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      upad_date TEXT NOT NULL,
      person_name TEXT,
      amount REAL NOT NULL,
      notes TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_upad_entries_date
      ON upad_entries(upad_date);
  `);

  console.log("Riseora ERP V1.1 owner-feedback migration completed");
}
