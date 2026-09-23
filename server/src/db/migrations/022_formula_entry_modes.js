import db from "../database.js";

function hasColumn(tableName, columnName) {
  return db
    .prepare(`PRAGMA table_info(${tableName})`)
    .all()
    .some((column) => column.name === columnName);
}

export function runFormulaEntryModeMigration() {
  if (!hasColumn("formulas", "entry_mode")) {
    db.exec(`
      ALTER TABLE formulas
      ADD COLUMN entry_mode TEXT NOT NULL DEFAULT 'QUANTITY';
    `);
  }

  if (!hasColumn("formulas", "composition_size")) {
    db.exec(`
      ALTER TABLE formulas
      ADD COLUMN composition_size REAL;
    `);
  }

  if (!hasColumn("formulas", "composition_unit_id")) {
    db.exec(`
      ALTER TABLE formulas
      ADD COLUMN composition_unit_id INTEGER;
    `);
  }

  db.exec(`
    UPDATE formulas
    SET entry_mode = 'QUANTITY'
    WHERE entry_mode IS NULL
       OR TRIM(entry_mode) = '';
  `);

  console.log("Formula entry-mode migration completed");
}
