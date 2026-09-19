import db from "../database.js";

export function runSalesMigration() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS sales_invoices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,

      invoice_no TEXT NOT NULL UNIQUE,
      invoice_date TEXT NOT NULL,

      customer_id INTEGER NOT NULL,

      customer_reference TEXT,

      subtotal REAL NOT NULL DEFAULT 0,
      discount_amount REAL NOT NULL DEFAULT 0,
      gst_amount REAL NOT NULL DEFAULT 0,
      other_charges REAL NOT NULL DEFAULT 0,
      grand_total REAL NOT NULL DEFAULT 0,

      amount_paid REAL NOT NULL DEFAULT 0,

      payment_status TEXT NOT NULL DEFAULT 'UNPAID',
      status TEXT NOT NULL DEFAULT 'POSTED',

      notes TEXT,

      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

      FOREIGN KEY (customer_id)
        REFERENCES customers(id)
    );

    CREATE TABLE IF NOT EXISTS sales_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,

      sales_invoice_id INTEGER NOT NULL,
      item_id INTEGER NOT NULL,

      quantity REAL NOT NULL,
      rate REAL NOT NULL,

      discount_amount REAL NOT NULL DEFAULT 0,

      taxable_amount REAL NOT NULL DEFAULT 0,

      gst_rate REAL NOT NULL DEFAULT 0,
      gst_amount REAL NOT NULL DEFAULT 0,

      line_total REAL NOT NULL DEFAULT 0,

      lot_no TEXT,

      FOREIGN KEY (sales_invoice_id)
        REFERENCES sales_invoices(id),

      FOREIGN KEY (item_id)
        REFERENCES items(id)
    );

    CREATE TABLE IF NOT EXISTS sales_payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,

      sales_invoice_id INTEGER NOT NULL,

      payment_date TEXT NOT NULL,
      amount REAL NOT NULL,

      payment_mode TEXT,
      reference_no TEXT,
      notes TEXT,

      status TEXT NOT NULL DEFAULT 'POSTED',

      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

      FOREIGN KEY (sales_invoice_id)
        REFERENCES sales_invoices(id)
    );
  `);

  console.log("Sales migration completed");
}