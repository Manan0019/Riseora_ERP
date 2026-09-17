import db from "../database.js";

export function runCustomerMigration() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,

      code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,

      phone TEXT,
      email TEXT,
      gstin TEXT,

      address TEXT,
      city TEXT,
      state TEXT,
      pincode TEXT,

      customer_type TEXT NOT NULL DEFAULT 'RETAIL',

      credit_days INTEGER NOT NULL DEFAULT 0,
      credit_limit REAL NOT NULL DEFAULT 0,

      notes TEXT,

      is_active INTEGER NOT NULL DEFAULT 1,

      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  console.log("Customer migration completed");
}