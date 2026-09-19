import db from "../database.js";

export function runStockAdjustmentMigration() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS stock_adjustments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,

      adjustment_no TEXT NOT NULL UNIQUE,
      adjustment_date TEXT NOT NULL,

      adjustment_type TEXT NOT NULL,

      reason TEXT NOT NULL,
      notes TEXT,

      status TEXT NOT NULL DEFAULT 'POSTED',

      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS stock_adjustment_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,

      stock_adjustment_id INTEGER NOT NULL,
      item_id INTEGER NOT NULL,

      quantity REAL NOT NULL,
      unit_cost REAL NOT NULL DEFAULT 0,

      lot_no TEXT,
      expiry_date TEXT,

      FOREIGN KEY (stock_adjustment_id)
        REFERENCES stock_adjustments(id),

      FOREIGN KEY (item_id)
        REFERENCES items(id)
    );
  `);

  console.log("Stock adjustment migration completed");
}