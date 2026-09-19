import db from "../database.js";

export function runSupplierPaymentMigration() {
  const purchaseColumns =
    db.prepare(`
      PRAGMA table_info(purchases)
    `).all();

  const hasAmountPaid =
    purchaseColumns.some(
      (column) =>
        column.name ===
        "amount_paid"
    );

  const hasPaymentStatus =
    purchaseColumns.some(
      (column) =>
        column.name ===
        "payment_status"
    );

  if (!hasAmountPaid) {
    db.exec(`
      ALTER TABLE purchases
      ADD COLUMN amount_paid REAL NOT NULL DEFAULT 0;
    `);
  }

  if (!hasPaymentStatus) {
    db.exec(`
      ALTER TABLE purchases
      ADD COLUMN payment_status TEXT NOT NULL DEFAULT 'UNPAID';
    `);
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS supplier_payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,

      purchase_id INTEGER NOT NULL,

      payment_date TEXT NOT NULL,
      amount REAL NOT NULL,

      payment_mode TEXT,
      reference_no TEXT,
      notes TEXT,

      status TEXT NOT NULL DEFAULT 'POSTED',

      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

      FOREIGN KEY (purchase_id)
        REFERENCES purchases(id)
    );
  `);

  console.log(
    "Supplier payment migration completed"
  );
}