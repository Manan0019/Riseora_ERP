import db from "../database.js";

function addColumnIfMissing(
  tableName,
  columnName,
  definition
) {
  const columns = db
    .prepare(
      `PRAGMA table_info(${tableName})`
    )
    .all();

  const exists = columns.some(
    (column) =>
      column.name === columnName
  );

  if (!exists) {
    db.exec(`
      ALTER TABLE ${tableName}
      ADD COLUMN ${columnName} ${definition}
    `);
  }
}

export function runProductionOverheadMigration() {
  addColumnIfMissing(
    "production_batches",
    "material_cost",
    "REAL NOT NULL DEFAULT 0"
  );

  addColumnIfMissing(
    "production_batches",
    "labour_cost",
    "REAL NOT NULL DEFAULT 0"
  );

  addColumnIfMissing(
    "production_batches",
    "electricity_cost",
    "REAL NOT NULL DEFAULT 0"
  );

  addColumnIfMissing(
    "production_batches",
    "other_overhead_cost",
    "REAL NOT NULL DEFAULT 0"
  );

  addColumnIfMissing(
    "production_batches",
    "total_production_cost",
    "REAL NOT NULL DEFAULT 0"
  );

  addColumnIfMissing(
    "production_batches",
    "finished_unit_cost",
    "REAL NOT NULL DEFAULT 0"
  );

  console.log(
    "Production overhead migration completed"
  );
}