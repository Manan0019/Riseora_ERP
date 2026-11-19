import db from "../database.js";

export function runPurchaseEntryUnitsMigration() {
  const columns = new Set(db.prepare(`PRAGMA table_info(purchase_items)`).all().map((column) => column.name));
  if (!columns.has("entry_quantity")) db.exec(`ALTER TABLE purchase_items ADD COLUMN entry_quantity REAL;`);
  if (!columns.has("entry_unit_id")) db.exec(`ALTER TABLE purchase_items ADD COLUMN entry_unit_id INTEGER;`);
  if (!columns.has("entry_rate")) db.exec(`ALTER TABLE purchase_items ADD COLUMN entry_rate REAL;`);
  if (!columns.has("hsn_code_snapshot")) db.exec(`ALTER TABLE purchase_items ADD COLUMN hsn_code_snapshot TEXT;`);
}
