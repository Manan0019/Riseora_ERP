import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const EPSILON = 0.0001;
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "riseora-regression-"));
const dbPath = path.join(tempDir, "riseora-regression.db");

process.env.NODE_ENV = "test";
process.env.RISEORA_DB_PATH = dbPath;
process.env.INITIAL_ADMIN_USERNAME = "ram";
process.env.INITIAL_ADMIN_FULL_NAME = "Ram";
process.env.INITIAL_ADMIN_PASSWORD = "1356";

function approx(actual, expected, tolerance = EPSILON, message = "") {
  assert.ok(
    Math.abs(Number(actual) - Number(expected)) <= tolerance,
    message || `Expected ${actual} to be within ${tolerance} of ${expected}`,
  );
}

function expectThrow(fn, pattern, label) {
  let error = null;
  try {
    fn();
  } catch (caught) {
    error = caught;
  }
  assert.ok(error, `${label}: expected operation to throw.`);
  if (pattern) {
    assert.match(String(error.message || error), pattern, `${label}: unexpected error message.`);
  }
}

function step(name, fn) {
  process.stdout.write(`• ${name} ... `);
  const result = fn();
  console.log("PASS");
  return result;
}

let db;
let passed = false;

try {
  const { initDatabase } = await import("../src/db/initDatabase.js");
  await initDatabase();

  db = (await import("../src/db/database.js")).default;

  const { authenticateUser } = await import("../src/services/authService.js");
  const { saveCompany } = await import("../src/services/companyService.js");
  const { createSupplier } = await import("../src/services/supplierService.js");
  const { createCustomer } = await import("../src/services/customerService.js");
  const { createItem, deactivateItem } = await import("../src/services/itemService.js");
  const { createOpeningStock } = await import("../src/services/openingStockService.js");
  const { createStockAdjustment } = await import("../src/services/stockAdjustmentService.js");
  const { createPurchase, cancelPurchase } = await import("../src/services/purchaseService.js");
  const { addSupplierPayment, getSupplierOutstanding } = await import("../src/services/supplierLedgerService.js");
  const {
    saveCustomerOpeningBalance,
    saveSupplierOpeningBalance,
    addCustomerOpeningSettlement,
    addSupplierOpeningSettlement,
  } = await import("../src/services/openingBalanceService.js");
  const { createFormula, updateFormula } = await import("../src/services/formulaService.js");
  const {
    createProductionPlan,
    startProductionBatch,
    completeProductionBatch,
    updateProductionQc,
    closeProductionBatch,
  } = await import("../src/services/productionService.js");
  const {
    createSale,
    addSalesPayment,
    addSalesRefund,
    getSalesInvoiceById,
  } = await import("../src/services/salesService.js");
  const {
    createSalesCreditNote,
    getReturnableSale,
  } = await import("../src/services/salesCreditNoteService.js");
  const { getCustomerOutstanding } = await import("../src/services/customerLedgerService.js");
  const { getCurrentStock, getItemStock } = await import("../src/services/stockService.js");
  const { getItemCostState } = await import("../src/services/costService.js");
  const { getReport, reportCatalog } = await import("../src/services/reportService.js");

  console.log(`Riseora ERP regression database: ${dbPath}`);

  process.stdout.write("• Fresh migrations + admin login ram / 1356 ... ");
  const login = await authenticateUser("ram", "1356");
  assert.equal(login?.username, "ram");
  assert.equal(login?.role, "ADMIN");
  console.log("PASS");

  const units = Object.fromEntries(
    db.prepare("SELECT id, code FROM units").all().map((row) => [row.code, Number(row.id)]),
  );
  const categories = Object.fromEntries(
    db.prepare("SELECT id, code FROM item_categories").all().map((row) => [row.code, Number(row.id)]),
  );
  assert.ok(units.KG && units.PCS && categories.RAW && categories.PACK && categories.FG && categories.CONS);

  step("Company master", () => {
    const company = saveCompany({
      name: "Riseora Herbals",
      legalName: "Riseora Herbals",
      address: "Regression Test Address",
      city: "Surat",
      state: "Gujarat",
      pincode: "395001",
      phone: "9999999999",
      email: "test@example.com",
      gstin: "24ABCDE1234F1Z5",
      bankName: "Test Bank",
      bankAccountName: "Riseora Herbals",
      bankAccountNo: "1234567890",
      bankIfsc: "TEST0000001",
      upiId: "riseora@test",
      invoiceTerms: "Regression test invoice terms.",
    });
    assert.equal(company.name, "Riseora Herbals");
  });

  const supplier = step("Supplier master", () => createSupplier({
    code: "SUP-TST",
    name: "Regression Supplier",
    paymentTermsDays: 30,
    state: "Gujarat",
  }));

  const customer = step("Customer master", () => createCustomer({
    code: "CUS-TST",
    name: "Regression Customer",
    customerType: "WHOLESALE",
    creditDays: 15,
    creditLimit: 100000,
    state: "Gujarat",
  }));

  const raw = step("Raw-material item", () => createItem({
    code: "RM-TST",
    name: "Regression Raw Oil",
    categoryId: categories.RAW,
    baseUnitId: units.KG,
    reorderLevel: 2,
    trackLot: false,
    trackExpiry: false,
    defaultSellingPrice: 0,
    targetMarginPercent: 0,
    defaultGstRate: 5,
  }));

  const pack = step("Packaging item", () => createItem({
    code: "PK-TST",
    name: "Regression Bottle",
    categoryId: categories.PACK,
    baseUnitId: units.PCS,
    reorderLevel: 20,
    trackLot: false,
    trackExpiry: false,
    defaultSellingPrice: 0,
    targetMarginPercent: 0,
    defaultGstRate: 5,
  }));

  const finished = step("Finished-goods item", () => createItem({
    code: "FG-TST",
    name: "Regression Finished Product",
    categoryId: categories.FG,
    baseUnitId: units.PCS,
    reorderLevel: 5,
    trackLot: false,
    trackExpiry: false,
    defaultSellingPrice: 100,
    targetMarginPercent: 50,
    hsnCode: "3304",
    defaultGstRate: 5,
  }));

  const zeroStockItem = step("Consumable validation item", () => createItem({
    code: "CS-TST",
    name: "Regression Zero Stock Item",
    categoryId: categories.CONS,
    baseUnitId: units.PCS,
    reorderLevel: 0,
    trackLot: false,
    trackExpiry: false,
    defaultSellingPrice: 0,
    targetMarginPercent: 0,
    defaultGstRate: 0,
  }));

  step("Customer opening receivable + partial receipt", () => {
    saveCustomerOpeningBalance(customer.id, {
      openingDate: "2026-08-31",
      balanceType: "DEBIT",
      amount: 500,
      notes: "Regression opening customer balance",
    });
    addCustomerOpeningSettlement(customer.id, {
      settlementDate: "2026-09-01",
      settlementType: "RECEIPT",
      amount: 200,
      paymentMode: "CASH",
    });
  });

  step("Supplier opening payable + partial payment", () => {
    saveSupplierOpeningBalance(supplier.id, {
      openingDate: "2026-08-31",
      balanceType: "CREDIT",
      amount: 1000,
      notes: "Regression opening supplier balance",
    });
    addSupplierOpeningSettlement(supplier.id, {
      settlementDate: "2026-09-01",
      settlementType: "PAYMENT",
      amount: 250,
      paymentMode: "BANK",
    });
  });

  step("Opening stock", () => {
    createOpeningStock({
      openingDate: "2026-09-01",
      notes: "Regression opening stock",
      items: [
        { itemId: raw.id, quantity: 10, unitCost: 180 },
        { itemId: pack.id, quantity: 100, unitCost: 8 },
      ],
    });
    approx(getItemStock(raw.id), 10);
    approx(getItemStock(pack.id), 100);
  });

  step("Stock adjustment negative-stock protection", () => {
    expectThrow(
      () => createStockAdjustment({
        adjustmentDate: "2026-09-01",
        adjustmentType: "OUT",
        reason: "Regression negative-stock guard",
        items: [{ itemId: zeroStockItem.id, quantity: 1 }],
      }),
      /exceeds available stock/i,
      "Stock adjustment OUT guard",
    );
  });

  const purchase = step("Purchase posting + landed cost + due date", () => {
    const result = createPurchase({
      purchaseDate: "2026-09-01",
      supplierId: supplier.id,
      supplierInvoiceNo: "SUP-INV-001",
      supplierInvoiceDate: "2026-09-01",
      freightAmount: 100,
      otherCharges: 0,
      notes: "Regression purchase",
      items: [
        { itemId: raw.id, quantity: 5, rate: 200, gstRate: 5 },
        { itemId: pack.id, quantity: 50, rate: 10, gstRate: 5 },
      ],
    });
    approx(result.subtotal, 1500);
    approx(result.gstAmount, 75);
    approx(result.grandTotal, 1675);
    assert.equal(result.dueDate, "2026-10-01");
    return result;
  });

  step("Duplicate supplier invoice protection", () => {
    expectThrow(
      () => createPurchase({
        purchaseDate: "2026-09-02",
        supplierId: supplier.id,
        supplierInvoiceNo: "SUP-INV-001",
        supplierInvoiceDate: "2026-09-02",
        freightAmount: 0,
        otherCharges: 0,
        items: [{ itemId: raw.id, quantity: 1, rate: 200, gstRate: 5 }],
      }),
      /already recorded/i,
      "Duplicate supplier invoice",
    );
  });

  step("Supplier partial payment", () => {
    const payment = addSupplierPayment(purchase.purchaseId, {
      paymentDate: "2026-09-02",
      amount: 500,
      paymentMode: "BANK",
    });
    approx(payment.balanceAmount, 1175);
  });

  const formula = step("Formula V1", () => createFormula({
    code: "FORM-TST",
    name: "Regression Formula",
    finishedItemId: finished.id,
    batchSize: 20,
    batchUnitId: units.PCS,
    notes: "Regression formula",
    ingredients: [
      { ingredientItemId: raw.id, quantity: 2, unitId: units.KG, percentage: "", notes: "" },
      { ingredientItemId: pack.id, quantity: 20, unitId: units.PCS, percentage: "", notes: "" },
    ],
  }));

  const production = step("Production plan 20", () => createProductionPlan({
    productionDate: "2026-09-03",
    formulaId: formula.formulaId,
    plannedBatchSize: 20,
    notes: "Regression production",
  }));

  step("Production start / WIP issue", () => {
    const started = startProductionBatch(production.productionBatchId, {});
    assert.equal(started.status, "IN_PRODUCTION");
    assert.ok(started.wipMaterialCost > 0);
  });

  const completed = step("Production actuals 20 planned → 18 good", () => {
    const result = completeProductionBatch(production.productionBatchId, {
      ingredients: [
        { itemId: raw.id, actualQuantity: 1.9, wasteQuantity: 0, lotNo: "" },
        { itemId: pack.id, actualQuantity: 21, wasteQuantity: 1, lotNo: "" },
      ],
      goodOutputQty: 18,
      rejectedQty: 1,
      reworkQty: 0,
      scrapQty: 1,
      labourCost: 100,
      electricityCost: 20,
      otherOverheadCost: 30,
      finishedLotNo: "",
      mfgDate: "2026-09-03",
      expiryDate: "",
      notes: "Regression actual production",
    });
    assert.equal(result.status, "COMPLETED");
    approx(result.goodOutputQty, 18);
    approx(result.yieldPercent, 90);
    assert.ok(result.finishedUnitCost > 0);
    return result;
  });

  step("Production QC + close", () => {
    const qc = updateProductionQc(production.productionBatchId, {
      qcStatus: "PASSED",
      qcNotes: "Regression QC passed",
    });
    assert.equal(qc.qcStatus, "PASSED");
    const closed = closeProductionBatch(production.productionBatchId);
    assert.equal(closed.status, "CLOSED");
  });

  step("Formula history lock after production", () => {
    expectThrow(
      () => updateFormula(formula.formulaId, {
        code: "FORM-TST",
        name: "Regression Formula edited",
        versionNo: 1,
        finishedItemId: finished.id,
        batchSize: 20,
        batchUnitId: units.PCS,
        ingredients: [
          { ingredientItemId: raw.id, quantity: 2, unitId: units.KG, percentage: "" },
          { ingredientItemId: pack.id, quantity: 20, unitId: units.PCS, percentage: "" },
        ],
      }),
      /already been used/i,
      "Used formula edit guard",
    );
  });

  step("Stock after actual production", () => {
    approx(getItemStock(raw.id), 13.1);
    approx(getItemStock(pack.id), 129);
    approx(getItemStock(finished.id), 18);
  });

  step("Purchase cancellation blocked after downstream usage", () => {
    expectThrow(
      () => cancelPurchase(purchase.purchaseId),
      /supplier payment recorded|subsequent stock usage/i,
      "Purchase cancellation safety guard",
    );
  });

  step("Finished-stock oversell protection", () => {
    expectThrow(
      () => createSale({
        invoiceDate: "2026-09-05",
        customerId: customer.id,
        amountPaid: 0,
        discountAmount: 0,
        otherCharges: 0,
        items: [{ itemId: finished.id, quantity: 999, rate: 100, gstRate: 5, discountAmount: 0 }],
      }),
      /insufficient stock/i,
      "Sales stock guard",
    );
  });

  const sale = step("Sales invoice + tax + due date + full payment", () => {
    const result = createSale({
      invoiceDate: "2026-09-05",
      customerId: customer.id,
      customerReference: "REG-ORDER-1",
      amountPaid: 1050,
      paymentMode: "UPI",
      discountAmount: 0,
      otherCharges: 0,
      notes: "Regression invoice",
      items: [
        { itemId: finished.id, quantity: 10, rate: 100, gstRate: 5, discountAmount: 0 },
      ],
    });
    approx(result.grandTotal, 1050);
    assert.equal(result.paymentStatus, "PAID");
    assert.equal(result.taxType, "INTRA_STATE");
    assert.equal(result.dueDate, "2026-09-20");
    return result;
  });

  step("Overpayment protection", () => {
    expectThrow(
      () => addSalesPayment(sale.salesInvoiceId, {
        paymentDate: "2026-09-05",
        amount: 1,
        paymentMode: "CASH",
      }),
      /cannot exceed outstanding balance/i,
      "Sales overpayment guard",
    );
  });

  const returnable = getReturnableSale(sale.salesInvoiceId);
  const salesItem = returnable.items[0];

  const credit = step("Sales return / credit note", () => {
    const result = createSalesCreditNote({
      salesInvoiceId: sale.salesInvoiceId,
      creditNoteDate: "2026-09-06",
      reason: "Regression return",
      notes: "Two units returned",
      items: [{ salesItemId: salesItem.sales_item_id, quantity: 2 }],
    });
    approx(result.grandTotal, 210);
    approx(result.refundDue, 210);
    return result;
  });

  step("Customer refund", () => {
    const result = addSalesRefund(sale.salesInvoiceId, {
      refundDate: "2026-09-06",
      amount: credit.refundDue,
      refundMode: "UPI",
      notes: "Regression refund",
    });
    approx(result.refundDue, 0);
    assert.equal(result.paymentStatus, "PAID");
  });

  step("Final finished stock after return", () => {
    approx(getItemStock(finished.id), 10);
  });

  step("Customer outstanding includes opening balance correctly", () => {
    const row = getCustomerOutstanding().find((entry) => Number(entry.customer_id) === Number(customer.id));
    assert.ok(row);
    approx(row.outstanding, 300);
  });

  step("Supplier outstanding includes opening + purchase balance", () => {
    const row = getSupplierOutstanding().find((entry) => Number(entry.supplier_id) === Number(supplier.id));
    assert.ok(row);
    approx(row.outstanding, 1925);
  });

  step("Physical stock and costing quantities reconcile", () => {
    const stockRows = getCurrentStock();
    for (const item of [raw, pack, finished]) {
      const row = stockRows.find((entry) => Number(entry.id) === Number(item.id));
      assert.ok(row, `Missing current-stock row for ${item.code}`);
      assert.equal(row.costing_status, "OK", `${item.code} costing status must be OK.`);
      const costState = getItemCostState(item.id);
      approx(row.current_stock, costState?.quantity || 0);
      assert.ok(Number(costState?.inventory_value || 0) >= -EPSILON);
    }
  });

  step("Invoice financial summary settled after return/refund", () => {
    const invoice = getSalesInvoiceById(sale.salesInvoiceId);
    approx(invoice.balance_amount, 0);
    approx(invoice.refund_due, 0);
    assert.equal(invoice.payment_status, "PAID");
  });

  step("All business reports generate", () => {
    const common = { fromDate: "2026-08-01", toDate: "2026-12-31" };
    for (const report of reportCatalog) {
      const filters = { ...common };
      if (report.key === "customer-ledger") filters.customerId = customer.id;
      if (report.key === "supplier-ledger") filters.supplierId = supplier.id;
      if (report.key === "stock-ledger") filters.itemId = finished.id;
      if (report.key === "expiry") filters.days = 365;
      const result = getReport(report.key, filters);
      assert.equal(result.key, report.key);
      assert.ok(Array.isArray(result.rows), `${report.key}: rows should be an array.`);
      assert.ok(Array.isArray(result.columns), `${report.key}: columns should be an array.`);
    }
  });

  step("Database integrity", () => {
    const integrity = db.pragma("integrity_check", { simple: true });
    assert.equal(String(integrity).toLowerCase(), "ok");
    const fk = db.pragma("foreign_key_check");
    assert.equal(fk.length, 0, "Foreign-key check should return no errors.");
  });

  passed = true;
  console.log("\nRESULT: PASS — Riseora ERP full business regression completed successfully.");
  console.log(`Production unit cost tested: ₹${Number(completed.finishedUnitCost).toFixed(4)}`);
} catch (error) {
  console.error("\nRESULT: FAIL — Riseora ERP regression stopped.");
  console.error(error?.stack || error);
  process.exitCode = 1;
} finally {
  try {
    db?.close();
  } catch {
    // Ignore cleanup errors.
  }

  if (passed) {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Keeping the temp folder is harmless if cleanup is blocked by the OS.
    }
  } else {
    console.error(`Regression database kept for inspection: ${dbPath}`);
  }
}
