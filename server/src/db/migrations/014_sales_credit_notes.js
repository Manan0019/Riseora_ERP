import db from "../database.js";

export function runSalesCreditNoteMigration() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS sales_credit_notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,

      credit_note_no TEXT NOT NULL UNIQUE,
      credit_note_date TEXT NOT NULL,

      sales_invoice_id INTEGER NOT NULL,
      customer_id INTEGER NOT NULL,

      subtotal REAL NOT NULL DEFAULT 0,
      discount_amount REAL NOT NULL DEFAULT 0,
      gst_amount REAL NOT NULL DEFAULT 0,
      grand_total REAL NOT NULL DEFAULT 0,

      reason TEXT NOT NULL,
      notes TEXT,

      status TEXT NOT NULL DEFAULT 'POSTED',

      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

      FOREIGN KEY (sales_invoice_id)
        REFERENCES sales_invoices(id),

      FOREIGN KEY (customer_id)
        REFERENCES customers(id)
    );

    CREATE TABLE IF NOT EXISTS sales_credit_note_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,

      sales_credit_note_id INTEGER NOT NULL,
      sales_item_id INTEGER NOT NULL,

      item_id INTEGER NOT NULL,

      quantity REAL NOT NULL,

      rate REAL NOT NULL DEFAULT 0,

      discount_amount REAL NOT NULL DEFAULT 0,
      taxable_amount REAL NOT NULL DEFAULT 0,

      gst_rate REAL NOT NULL DEFAULT 0,
      gst_amount REAL NOT NULL DEFAULT 0,

      line_total REAL NOT NULL DEFAULT 0,

      unit_cost REAL NOT NULL DEFAULT 0,

      lot_no TEXT,

      FOREIGN KEY (sales_credit_note_id)
        REFERENCES sales_credit_notes(id),

      FOREIGN KEY (sales_item_id)
        REFERENCES sales_items(id),

      FOREIGN KEY (item_id)
        REFERENCES items(id)
    );

    CREATE INDEX IF NOT EXISTS
      idx_sales_credit_notes_invoice
    ON sales_credit_notes(
      sales_invoice_id
    );

    CREATE INDEX IF NOT EXISTS
      idx_sales_credit_notes_customer
    ON sales_credit_notes(
      customer_id
    );

    CREATE INDEX IF NOT EXISTS
      idx_sales_credit_note_items_sale_item
    ON sales_credit_note_items(
      sales_item_id
    );
  `);

  console.log(
    "Sales credit note migration completed"
  );
}