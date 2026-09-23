import db from "../database.js";

function hasColumn(tableName, columnName) {
  return db.prepare(`PRAGMA table_info(${tableName})`).all().some((column) => column.name === columnName);
}

function addColumn(tableName, definition) {
  const columnName = definition.trim().split(/\s+/)[0];
  if (!hasColumn(tableName, columnName)) {
    db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${definition}`);
  }
}

export function runCreditTermsDueDateMigration() {
  addColumn("sales_invoices", "credit_days_snapshot INTEGER NOT NULL DEFAULT 0");
  addColumn("sales_invoices", "due_date TEXT");
  addColumn("purchases", "payment_terms_days_snapshot INTEGER NOT NULL DEFAULT 0");
  addColumn("purchases", "due_date TEXT");

  db.exec(`
    UPDATE sales_invoices
    SET credit_days_snapshot = COALESCE(
      (SELECT credit_days FROM customers WHERE customers.id = sales_invoices.customer_id),
      credit_days_snapshot,
      0
    )
    WHERE due_date IS NULL;

    UPDATE sales_invoices
    SET due_date = date(invoice_date, '+' || COALESCE(credit_days_snapshot, 0) || ' days')
    WHERE due_date IS NULL AND invoice_date IS NOT NULL;

    UPDATE purchases
    SET payment_terms_days_snapshot = COALESCE(
      (SELECT payment_terms_days FROM suppliers WHERE suppliers.id = purchases.supplier_id),
      payment_terms_days_snapshot,
      0
    )
    WHERE due_date IS NULL;

    UPDATE purchases
    SET due_date = date(purchase_date, '+' || COALESCE(payment_terms_days_snapshot, 0) || ' days')
    WHERE due_date IS NULL AND purchase_date IS NOT NULL;
  `);

  console.log("Credit terms and due-date migration completed");
}
