import db from "../database.js";

export function runSupplierMigration() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS suppliers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,

      code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,

      contact_person TEXT,
      phone TEXT,
      email TEXT,

      gstin TEXT,

      address TEXT,
      city TEXT,
      state TEXT,
      pincode TEXT,

      payment_terms_days INTEGER NOT NULL DEFAULT 0,

      notes TEXT,

      is_active INTEGER NOT NULL DEFAULT 1,

      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  console.log("Supplier migration completed");
}