import db from "../database.js";

export function runSalesRefundMigration() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS sales_refunds (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      refund_no TEXT NOT NULL UNIQUE,
      refund_date TEXT NOT NULL,
      sales_invoice_id INTEGER NOT NULL,
      customer_id INTEGER NOT NULL,
      amount REAL NOT NULL,
      refund_mode TEXT NOT NULL DEFAULT 'CASH',
      reference_no TEXT,
      notes TEXT,
      status TEXT NOT NULL DEFAULT 'POSTED',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (sales_invoice_id) REFERENCES sales_invoices(id),
      FOREIGN KEY (customer_id) REFERENCES customers(id)
    );

    CREATE INDEX IF NOT EXISTS idx_sales_refunds_invoice
      ON sales_refunds(sales_invoice_id);

    CREATE INDEX IF NOT EXISTS idx_sales_refunds_customer
      ON sales_refunds(customer_id);
  `);

  console.log("Sales refund migration completed");
}
