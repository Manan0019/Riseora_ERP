import { runInitialMigration } from "./migrations/001_initial_schema.js";
import { seedUnits } from "./seeds/seedUnits.js";
import { seedItemCategories } from "./seeds/seedItemCategories.js";
import { seedAdmin } from "./seeds/seedAdmin.js";
import { runSupplierMigration } from "./migrations/002_suppliers.js";
import { runCustomerMigration } from "./migrations/003_customers.js";

export async function initDatabase() {
  runInitialMigration();
  runSupplierMigration();
  runCustomerMigration();

  seedUnits();
  seedItemCategories();

  await seedAdmin();
}