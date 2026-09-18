import db from "../database.js";

export function runPurchaseInventoryMigration() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS purchases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,

      purchase_no TEXT NOT NULL UNIQUE,
      purchase_date TEXT NOT NULL,

      supplier_id INTEGER NOT NULL,

      supplier_invoice_no TEXT,
      supplier_invoice_date TEXT,

      subtotal REAL NOT NULL DEFAULT 0,
      gst_amount REAL NOT NULL DEFAULT 0,
      freight_amount REAL NOT NULL DEFAULT 0,
      other_charges REAL NOT NULL DEFAULT 0,

      grand_total REAL NOT NULL DEFAULT 0,

      notes TEXT,

      status TEXT NOT NULL DEFAULT 'POSTED',

      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

      FOREIGN KEY (supplier_id)
        REFERENCES suppliers(id)
    );

    CREATE TABLE IF NOT EXISTS purchase_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,

      purchase_id INTEGER NOT NULL,
      item_id INTEGER NOT NULL,

      quantity REAL NOT NULL,
      rate REAL NOT NULL,

      taxable_amount REAL NOT NULL DEFAULT 0,

      gst_rate REAL NOT NULL DEFAULT 0,
      gst_amount REAL NOT NULL DEFAULT 0,

      line_total REAL NOT NULL DEFAULT 0,

      lot_no TEXT,
      mfg_date TEXT,
      expiry_date TEXT,

      FOREIGN KEY (purchase_id)
        REFERENCES purchases(id),

      FOREIGN KEY (item_id)
        REFERENCES items(id)
    );

    CREATE TABLE IF NOT EXISTS stock_transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,

      transaction_date TEXT NOT NULL,

      item_id INTEGER NOT NULL,

      transaction_type TEXT NOT NULL,

      reference_type TEXT NOT NULL,
      reference_id INTEGER,
      reference_no TEXT,

      quantity_in REAL NOT NULL DEFAULT 0,
      quantity_out REAL NOT NULL DEFAULT 0,

      unit_cost REAL NOT NULL DEFAULT 0,

      lot_no TEXT,
      expiry_date TEXT,

      notes TEXT,

      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

      FOREIGN KEY (item_id)
        REFERENCES items(id)
    );
  `);

  console.log(
    "Purchase and inventory migration completed"
  );
}