import db from "../database.js";

export function runFormulaMigration() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS formulas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,

      code TEXT NOT NULL,
      name TEXT NOT NULL,

      finished_item_id INTEGER NOT NULL,

      version_no INTEGER NOT NULL DEFAULT 1,

      batch_size REAL NOT NULL,
      batch_unit_id INTEGER NOT NULL,

      notes TEXT,

      is_active INTEGER NOT NULL DEFAULT 1,

      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

      FOREIGN KEY (finished_item_id)
        REFERENCES items(id),

      FOREIGN KEY (batch_unit_id)
        REFERENCES units(id),

      UNIQUE (code, version_no)
    );

    CREATE TABLE IF NOT EXISTS formula_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,

      formula_id INTEGER NOT NULL,

      ingredient_item_id INTEGER NOT NULL,

      quantity REAL NOT NULL,

      unit_id INTEGER NOT NULL,

      percentage REAL,

      sequence_no INTEGER NOT NULL DEFAULT 1,

      notes TEXT,

      FOREIGN KEY (formula_id)
        REFERENCES formulas(id),

      FOREIGN KEY (ingredient_item_id)
        REFERENCES items(id),

      FOREIGN KEY (unit_id)
        REFERENCES units(id)
    );
  `);

  console.log("Formula migration completed");
}