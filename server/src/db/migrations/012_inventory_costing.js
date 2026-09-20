import db from "../database.js";

export function runInventoryCostingMigration() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS inventory_cost_state (
      item_id INTEGER PRIMARY KEY,

      quantity REAL NOT NULL DEFAULT 0,
      inventory_value REAL NOT NULL DEFAULT 0,
      average_cost REAL NOT NULL DEFAULT 0,

      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

      FOREIGN KEY (item_id)
        REFERENCES items(id)
    );
  `);

  console.log(
    "Inventory costing migration completed"
  );
}