import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "riseora-actual-materials-"));
const dbPath = path.join(tempDir, "riseora-actual-materials.db");

process.env.NODE_ENV = "test";
process.env.RISEORA_DB_PATH = dbPath;
process.env.INITIAL_ADMIN_USERNAME = "ram";
process.env.INITIAL_ADMIN_FULL_NAME = "Ram";
process.env.INITIAL_ADMIN_PASSWORD = "RiseoraTest2026!";

const approx = (actual, expected, tolerance = 0.0001) => {
  assert.ok(
    Math.abs(Number(actual) - Number(expected)) <= tolerance,
    `Expected ${actual} to be approximately ${expected}`,
  );
};

let db;
let passed = false;

try {
  const { initDatabase } = await import("../src/db/initDatabase.js");
  await initDatabase();

  db = (await import("../src/db/database.js")).default;
  const { createItem } = await import("../src/services/itemService.js");
  const { createOpeningStock } = await import("../src/services/openingStockService.js");
  const { createFormula } = await import("../src/services/formulaService.js");
  const {
    createProductionPlan,
    startProductionBatch,
    completeProductionBatch,
    correctProductionBatch,
    getProductionBatchById,
  } = await import("../src/services/productionService.js");
  const { getItemStock } = await import("../src/services/stockService.js");

  const units = Object.fromEntries(
    db.prepare("SELECT id, code FROM units").all().map((row) => [row.code, Number(row.id)]),
  );
  const categories = Object.fromEntries(
    db.prepare("SELECT id, code FROM item_categories").all().map((row) => [row.code, Number(row.id)]),
  );

  const raw = createItem({
    code: "TST-ACT-RAW",
    name: "Actual Material Test Oil",
    categoryId: categories.RAW,
    baseUnitId: units.KG,
    reorderLevel: 0,
    trackLot: false,
    trackExpiry: false,
    defaultSellingPrice: 0,
    targetMarginPercent: 0,
    defaultGstRate: 5,
  });

  const bottle = createItem({
    code: "TST-ACT-BTL",
    name: "Actual Material Test Bottle",
    categoryId: categories.PACK,
    baseUnitId: units.PCS,
    reorderLevel: 0,
    trackLot: false,
    trackExpiry: false,
    defaultSellingPrice: 0,
    targetMarginPercent: 0,
    defaultGstRate: 5,
  });

  const carton = createItem({
    code: "TST-ACT-BOX",
    name: "Actual Material Test Extra Carton",
    categoryId: categories.PACK,
    baseUnitId: units.PCS,
    reorderLevel: 0,
    trackLot: false,
    trackExpiry: false,
    defaultSellingPrice: 0,
    targetMarginPercent: 0,
    defaultGstRate: 5,
  });

  const finished = createItem({
    code: "TST-ACT-FG",
    name: "Actual Material Test Finished Product",
    categoryId: categories.FG,
    baseUnitId: units.PCS,
    reorderLevel: 0,
    trackLot: false,
    trackExpiry: false,
    defaultSellingPrice: 100,
    targetMarginPercent: 40,
    defaultGstRate: 5,
  });

  createOpeningStock({
    openingDate: "2026-09-24",
    notes: "Actual-material production test",
    items: [
      { itemId: raw.id, quantity: 10, unitCost: 100 },
      { itemId: bottle.id, quantity: 50, unitCost: 5 },
      { itemId: carton.id, quantity: 10, unitCost: 8 },
    ],
  });

  const formula = createFormula({
    code: "TST-ACT-FORM",
    name: "Actual Material Test Formula",
    finishedItemId: finished.id,
    batchSize: 20,
    batchUnitId: units.PCS,
    entryMode: "QUANTITY",
    notes: "Test formula",
    ingredients: [
      { ingredientItemId: raw.id, quantity: 2, unitId: units.KG, percentage: "", notes: "" },
      { ingredientItemId: bottle.id, quantity: 20, unitId: units.PCS, percentage: "", notes: "" },
    ],
    processExtras: [],
  });

  const plan = createProductionPlan({
    productionDate: "2026-09-24",
    formulaId: formula.formulaId,
    plannedBatchSize: 20,
    notes: "20 planned",
  });

  startProductionBatch(plan.productionBatchId, {});

  const completed = completeProductionBatch(plan.productionBatchId, {
    ingredients: [
      { itemId: raw.id, actualQuantity: 2, wasteQuantity: 0, lotNo: "" },
      { itemId: bottle.id, actualQuantity: 19, wasteQuantity: 0, lotNo: "" },
    ],
    additionalMaterials: [
      {
        itemId: carton.id,
        actualQuantity: 1,
        wasteQuantity: 0,
        lotNo: "",
        reason: "One extra shipping carton used for this batch",
      },
    ],
    goodOutputQty: 19,
    rejectedQty: 0,
    reworkQty: 0,
    scrapQty: 0,
    labourCost: 0,
    electricityCost: 0,
    otherOverheadCost: 0,
    finishedLotNo: "",
    mfgDate: "2026-09-24",
    expiryDate: "",
    notes: "Actual output 19",
  });

  assert.equal(completed.status, "COMPLETED");
  approx(completed.goodOutputQty, 19);
  approx(getItemStock(raw.id), 8);
  approx(getItemStock(bottle.id), 31);
  approx(getItemStock(carton.id), 9);
  approx(getItemStock(finished.id), 19);

  let details = getProductionBatchById(plan.productionBatchId);
  let actualExtra = details.consumption.find(
    (row) => String(row.component_role || "").toUpperCase() === "ACTUAL_EXTRA",
  );
  assert.ok(actualExtra, "Actual-extra production row should exist.");
  assert.equal(Number(actualExtra.item_id), Number(carton.id));
  approx(actualExtra.actual_quantity, 1);
  assert.match(String(actualExtra.extra_reason || ""), /extra shipping carton/i);

  const corrected = correctProductionBatch(plan.productionBatchId, {
    ingredients: [
      { itemId: raw.id, actualQuantity: 2, wasteQuantity: 0, lotNo: "" },
      { itemId: bottle.id, actualQuantity: 21, wasteQuantity: 0, lotNo: "" },
    ],
    additionalMaterials: [
      {
        itemId: carton.id,
        actualQuantity: 2,
        wasteQuantity: 0,
        lotNo: "",
        reason: "Two cartons were actually used",
      },
    ],
    goodOutputQty: 21,
    rejectedQty: 0,
    reworkQty: 0,
    scrapQty: 0,
    labourCost: 0,
    electricityCost: 0,
    otherOverheadCost: 0,
    finishedLotNo: "",
    mfgDate: "2026-09-24",
    expiryDate: "",
    notes: "Corrected actual output 21",
    correctionReason: "Physical recount after packing",
  });

  assert.equal(corrected.status, "COMPLETED");
  approx(corrected.goodOutputQty, 21);
  approx(getItemStock(raw.id), 8);
  approx(getItemStock(bottle.id), 29);
  approx(getItemStock(carton.id), 8);
  approx(getItemStock(finished.id), 21);

  details = getProductionBatchById(plan.productionBatchId);
  actualExtra = details.consumption.find(
    (row) => String(row.component_role || "").toUpperCase() === "ACTUAL_EXTRA",
  );
  assert.ok(actualExtra, "Corrected actual-extra row should exist.");
  approx(actualExtra.actual_quantity, 2);
  assert.match(String(actualExtra.extra_reason || ""), /two cartons/i);

  const actualExtraRows = details.consumption.filter(
    (row) => String(row.component_role || "").toUpperCase() === "ACTUAL_EXTRA",
  );
  assert.equal(actualExtraRows.length, 1, "Correction must replace, not duplicate, actual-extra rows.");

  const integrity = db.pragma("integrity_check", { simple: true });
  assert.equal(String(integrity).toLowerCase(), "ok");
  assert.equal(db.pragma("foreign_key_check").length, 0);

  passed = true;
  console.log("RESULT: PASS — production actual-only material completion + correction");
} catch (error) {
  console.error("RESULT: FAIL — production actual-only material test");
  console.error(error?.stack || error);
  process.exitCode = 1;
} finally {
  try {
    db?.close();
  } catch {
    // Ignore cleanup error.
  }

  if (passed) {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Harmless if Windows keeps a transient lock.
    }
  } else {
    console.error(`Test database kept for inspection: ${dbPath}`);
  }
}
