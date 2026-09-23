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
import { runProductionMigration } from "./migrations/009_production.js";
import { runSalesMigration } from "./migrations/010_sales.js";
import { runSupplierPaymentMigration } from "./migrations/011_supplier_payments.js";
import { runInventoryCostingMigration } from "./migrations/012_inventory_costing.js";
import { runProductionOverheadMigration } from "./migrations/013_production_overheads.js";
import { runSalesCreditNoteMigration } from "./migrations/014_sales_credit_notes.js";
import { runSalesRefundMigration } from "./migrations/015_sales_refunds.js";
import { runAdvancedProductionMigration } from "./migrations/016_advanced_production.js";
import { runProductPricingMigration } from "./migrations/017_product_pricing.js";
import { runProfessionalInvoicingMigration } from "./migrations/018_professional_invoicing.js";
import { runOpeningPartyBalanceMigration } from "./migrations/019_opening_party_balances.js";
import { runCreditTermsDueDateMigration } from "./migrations/020_credit_terms_due_dates.js";
import { runDefaultAdminCredentialsMigration } from "./migrations/021_default_admin_credentials.js";
import { runFormulaEntryModeMigration } from "./migrations/022_formula_entry_modes.js";
import { runCategoryInventoryRoleMigration } from "./migrations/023_category_inventory_roles.js";
import { runFormulaProcessExtrasMigration } from "./migrations/024_formula_process_extras.js";
import { seedRiseoraCatalog } from "./seeds/seedRiseoraCatalog.js";


export async function initDatabase() {
  runInitialMigration();
  runSupplierMigration();
  runCustomerMigration();
  runItemMigration();
  runPurchaseInventoryMigration();
  runOpeningStockMigration();
  runStockAdjustmentMigration();
  runFormulaMigration();
  runProductionMigration();
  runSalesMigration();
  runSupplierPaymentMigration();
  runInventoryCostingMigration();
  runProductionOverheadMigration();
  runSalesCreditNoteMigration();
  runSalesRefundMigration();
  runAdvancedProductionMigration();
  runProductPricingMigration();
  runProfessionalInvoicingMigration();
  runOpeningPartyBalanceMigration();
  runCreditTermsDueDateMigration();
  runDefaultAdminCredentialsMigration();
  runFormulaEntryModeMigration();
  runCategoryInventoryRoleMigration();
  runFormulaProcessExtrasMigration();

  seedUnits();
  seedItemCategories();
  seedRiseoraCatalog();

  await seedAdmin();
}