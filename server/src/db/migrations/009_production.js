import db from "../database.js";

export function runProductionMigration() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS production_batches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,

      batch_no TEXT NOT NULL UNIQUE,
      production_date TEXT NOT NULL,

      formula_id INTEGER NOT NULL,

      planned_batch_size REAL NOT NULL,
      actual_output_qty REAL NOT NULL,

      batch_unit_id INTEGER NOT NULL,

      finished_item_id INTEGER NOT NULL,

      finished_lot_no TEXT,
      mfg_date TEXT,
      expiry_date TEXT,

      notes TEXT,

      status TEXT NOT NULL DEFAULT 'POSTED',

      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

      FOREIGN KEY (formula_id)
        REFERENCES formulas(id),

      FOREIGN KEY (batch_unit_id)
        REFERENCES units(id),

      FOREIGN KEY (finished_item_id)
        REFERENCES items(id)
    );

    CREATE TABLE IF NOT EXISTS production_consumption (
      id INTEGER PRIMARY KEY AUTOINCREMENT,

      production_batch_id INTEGER NOT NULL,

      item_id INTEGER NOT NULL,

      planned_quantity REAL NOT NULL,
      actual_quantity REAL NOT NULL,

      unit_id INTEGER NOT NULL,

      lot_no TEXT,

      unit_cost REAL NOT NULL DEFAULT 0,

      FOREIGN KEY (production_batch_id)
        REFERENCES production_batches(id),

      FOREIGN KEY (item_id)
        REFERENCES items(id),

      FOREIGN KEY (unit_id)
        REFERENCES units(id)
    );
  `);

  console.log("Production migration completed");
}