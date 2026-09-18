import db from "../database.js";

export function runItemMigration() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,

      code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,

      category_id INTEGER NOT NULL,
      base_unit_id INTEGER NOT NULL,

      reorder_level REAL NOT NULL DEFAULT 0,

      track_lot INTEGER NOT NULL DEFAULT 0,
      track_expiry INTEGER NOT NULL DEFAULT 0,

      density REAL,

      notes TEXT,

      is_active INTEGER NOT NULL DEFAULT 1,

      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

      FOREIGN KEY (category_id)
        REFERENCES item_categories(id),

      FOREIGN KEY (base_unit_id)
        REFERENCES units(id)
    );
  `);

  console.log("Item migration completed");
}