import { runInitialMigration } from "./migrations/001_initial_schema.js";
import { seedUnits } from "./seeds/seedUnits.js";
import { seedItemCategories } from "./seeds/seedItemCategories.js";
import { seedAdmin } from "./seeds/seedAdmin.js";
import { runSupplierMigration } from "./migrations/002_suppliers.js";
import { runCustomerMigration } from "./migrations/003_customers.js";
import { runItemMigration } from "./migrations/004_items.js";
import { runPurchaseInventoryMigration } from "./migrations/005_purchases_inventory.js";
import { runOpeningStockMigration } from "./migrations/006_opening_stock.js";
import { runStockAdjustmentMigration } from "./migrations/007_stock_adjustments.js";
import { runFormulaMigration } from "./migrations/008_formulas.js";

export async function initDatabase() {
  runInitialMigration();
  runSupplierMigration();
  runCustomerMigration();
  runItemMigration();
  runPurchaseInventoryMigration();
  runOpeningStockMigration();
  runStockAdjustmentMigration();
  runFormulaMigration();

  seedUnits();
  seedItemCategories();

  await seedAdmin();
}