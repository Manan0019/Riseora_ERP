import db from "../database.js";

function addColumnIfMissing(tableName, columnName, definition) {
  const columns = db.prepare(`PRAGMA table_info(${tableName})`).all();
  const exists = columns.some((column) => column.name === columnName);

  if (!exists) {
    db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
  }
}

export function runProductPricingMigration() {
  addColumnIfMissing(
    "items",
    "default_selling_price",
    "REAL NOT NULL DEFAULT 0",
  );

  addColumnIfMissing(
    "items",
    "target_margin_percent",
    "REAL NOT NULL DEFAULT 0",
  );

  addColumnIfMissing(
    "production_batches",
    "selling_price_snapshot",
    "REAL NOT NULL DEFAULT 0",
  );

  addColumnIfMissing(
    "production_batches",
    "target_margin_percent_snapshot",
    "REAL NOT NULL DEFAULT 0",
  );

  addColumnIfMissing(
    "production_batches",
    "suggested_selling_price",
    "REAL NOT NULL DEFAULT 0",
  );

  console.log("Product pricing migration completed");
}
