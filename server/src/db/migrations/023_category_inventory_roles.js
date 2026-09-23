import db from "../database.js";

function hasColumn(tableName, columnName) {
  return db
    .prepare(`PRAGMA table_info(${tableName})`)
    .all()
    .some((column) => column.name === columnName);
}

export function runCategoryInventoryRoleMigration() {
  if (!hasColumn("item_categories", "inventory_role")) {
    db.exec(`
      ALTER TABLE item_categories
      ADD COLUMN inventory_role TEXT NOT NULL DEFAULT 'CONS';
    `);
  }

  db.exec(`
    UPDATE item_categories
    SET inventory_role = CASE
      WHEN UPPER(code) = 'RAW' THEN 'RAW'
      WHEN UPPER(code) = 'PACK' THEN 'PACK'
      WHEN UPPER(code) = 'FG' THEN 'FG'
      WHEN UPPER(code) = 'CONS' THEN 'CONS'
      WHEN inventory_role IS NULL OR TRIM(inventory_role) = '' THEN 'CONS'
      ELSE UPPER(inventory_role)
    END;
  `);

  console.log("Item-category inventory-role migration completed");
}
