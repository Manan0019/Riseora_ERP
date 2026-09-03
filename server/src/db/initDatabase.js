import { runInitialMigration } from "./migrations/001_initial_schema.js";
import { seedUnits } from "./seeds/seedUnits.js";
import { seedItemCategories } from "./seeds/seedItemCategories.js";
import { seedAdmin } from "./seeds/seedAdmin.js";

export async function initDatabase() {
  runInitialMigration();
  seedUnits();
  seedItemCategories();
  await seedAdmin();
}