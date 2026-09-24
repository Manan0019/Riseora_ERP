import db from "../database.js";

function hasColumn(tableName, columnName) {
  return db
    .prepare(`PRAGMA table_info(${tableName})`)
    .all()
    .some((column) => column.name === columnName);
}

export function runPartyAlternatePhoneMigration() {
  if (!hasColumn("suppliers", "alternate_phone")) {
    db.exec(`
      ALTER TABLE suppliers
      ADD COLUMN alternate_phone TEXT;
    `);
  }

  if (!hasColumn("customers", "alternate_phone")) {
    db.exec(`
      ALTER TABLE customers
      ADD COLUMN alternate_phone TEXT;
    `);
  }

  console.log("Customer/supplier alternate-phone migration completed");
}
