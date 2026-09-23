import db from "../database.js";

export function runOpeningPartyBalanceMigration() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS customer_opening_balances (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER NOT NULL UNIQUE,
      opening_date TEXT NOT NULL,
      balance_type TEXT NOT NULL CHECK (balance_type IN ('DEBIT', 'CREDIT')),
      amount REAL NOT NULL DEFAULT 0 CHECK (amount >= 0),
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (customer_id) REFERENCES customers(id)
    );

    CREATE TABLE IF NOT EXISTS customer_opening_balance_settlements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_opening_balance_id INTEGER NOT NULL,
      customer_id INTEGER NOT NULL,
      settlement_date TEXT NOT NULL,
      settlement_type TEXT NOT NULL CHECK (settlement_type IN ('RECEIPT', 'REFUND')),
      amount REAL NOT NULL CHECK (amount > 0),
      payment_mode TEXT NOT NULL DEFAULT 'CASH',
      reference_no TEXT,
      notes TEXT,
      status TEXT NOT NULL DEFAULT 'POSTED',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (customer_opening_balance_id) REFERENCES customer_opening_balances(id),
      FOREIGN KEY (customer_id) REFERENCES customers(id)
    );

    CREATE INDEX IF NOT EXISTS idx_customer_opening_settlements_customer
      ON customer_opening_balance_settlements(customer_id, settlement_date, id);

    CREATE TABLE IF NOT EXISTS supplier_opening_balances (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      supplier_id INTEGER NOT NULL UNIQUE,
      opening_date TEXT NOT NULL,
      balance_type TEXT NOT NULL CHECK (balance_type IN ('DEBIT', 'CREDIT')),
      amount REAL NOT NULL DEFAULT 0 CHECK (amount >= 0),
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
    );

    CREATE TABLE IF NOT EXISTS supplier_opening_balance_settlements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      supplier_opening_balance_id INTEGER NOT NULL,
      supplier_id INTEGER NOT NULL,
      settlement_date TEXT NOT NULL,
      settlement_type TEXT NOT NULL CHECK (settlement_type IN ('PAYMENT', 'RECEIPT')),
      amount REAL NOT NULL CHECK (amount > 0),
      payment_mode TEXT NOT NULL DEFAULT 'CASH',
      reference_no TEXT,
      notes TEXT,
      status TEXT NOT NULL DEFAULT 'POSTED',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (supplier_opening_balance_id) REFERENCES supplier_opening_balances(id),
      FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
    );

    CREATE INDEX IF NOT EXISTS idx_supplier_opening_settlements_supplier
      ON supplier_opening_balance_settlements(supplier_id, settlement_date, id);
  `);

  console.log("Customer and supplier opening balance migration completed");
}
