import db from "../database.js";

function addColumnIfMissing(tableName, columnName, definition) {
  const columns = db.prepare(`PRAGMA table_info(${tableName})`).all();
  if (!columns.some((column) => column.name === columnName)) {
    db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
  }
}

export function runFormulaProcessExtrasMigration() {
  addColumnIfMissing(
    "formula_items",
    "component_role",
    "TEXT NOT NULL DEFAULT 'FORMULA'",
  );
  addColumnIfMissing(
    "formula_items",
    "extra_reason",
    "TEXT",
  );


  addColumnIfMissing(
    "production_consumption",
    "formula_planned_quantity",
    "REAL NOT NULL DEFAULT 0",
  );
  addColumnIfMissing(
    "production_consumption",
    "process_extra_planned_quantity",
    "REAL NOT NULL DEFAULT 0",
  );

  addColumnIfMissing(
    "production_consumption",
    "component_role",
    "TEXT NOT NULL DEFAULT 'FORMULA'",
  );
  addColumnIfMissing(
    "production_consumption",
    "extra_reason",
    "TEXT",
  );

  db.exec(`
    UPDATE formula_items
    SET component_role = 'FORMULA'
    WHERE component_role IS NULL OR TRIM(component_role) = '';

    UPDATE production_consumption
    SET component_role = 'FORMULA'
    WHERE component_role IS NULL OR TRIM(component_role) = '';
  `);

  console.log("Formula process-extra migration completed");
}
