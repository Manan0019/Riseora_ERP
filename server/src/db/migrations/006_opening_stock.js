import db from "../database.js";

export function runOpeningStockMigration() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS opening_stock_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,

      opening_no TEXT NOT NULL UNIQUE,
      opening_date TEXT NOT NULL,

      notes TEXT,

      status TEXT NOT NULL DEFAULT 'POSTED',

      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS opening_stock_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,

      opening_stock_id INTEGER NOT NULL,
      item_id INTEGER NOT NULL,

      quantity REAL NOT NULL,
      unit_cost REAL NOT NULL DEFAULT 0,

      lot_no TEXT,
      expiry_date TEXT,

      FOREIGN KEY (opening_stock_id)
        REFERENCES opening_stock_entries(id),

      FOREIGN KEY (item_id)
        REFERENCES items(id)
    );
  `);

  console.log("Opening stock migration completed");
}