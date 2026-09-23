import db from "../db/database.js";

import {
  addStockTransaction,
  getItemStock,
} from "./stockService.js";

import { getFormulaById } from "./formulaService.js";

import {
  addInventoryValue,
  removeInventoryValue,
  reverseInventoryReceipt,
} from "./costService.js";

import {
  convertQuantity,
  convertQuantityByUnitIds,
  getItemBaseUnit,
  getUnitById,
} from "./unitConversionService.js";

const EPSILON = 0.0000001;
const QC_STATUSES = new Set(["NOT_CHECKED", "PASSED", "FAILED"]);

function generateBatchNumber() {
  const year = new Date().getFullYear();
  const lastBatch = db.prepare(`
    SELECT id
    FROM production_batches
    ORDER BY id DESC
    LIMIT 1
  `).get();

  const nextNumber = Number(lastBatch?.id || 0) + 1;
  return `BATCH-${year}-${String(nextNumber).padStart(5, "0")}`;
}

function requirePositive(value, label) {
  const result = Number(value);
  if (!Number.isFinite(result) || result <= 0) {
    throw new Error(`${label} must be greater than zero.`);
  }
  return result;
}

function requireNonNegative(value, label) {
  const result = Number(value || 0);
  if (!Number.isFinite(result) || result < 0) {
    throw new Error(`${label} cannot be negative.`);
  }
  return result;
}

function getBatchOrThrow(id) {
  const batch = db.prepare(`
    SELECT *
    FROM production_batches
    WHERE id = ?
  `).get(Number(id));

  if (!batch) {
    throw new Error("Production batch not found.");
  }

  return batch;
}

function insertEvent(batchId, eventType, reason = null, details = null) {
  db.prepare(`
    INSERT INTO production_batch_events (
      production_batch_id,
      event_type,
      reason,
      details_json
    )
    VALUES (?, ?, ?, ?)
  `).run(
    Number(batchId),
    eventType,
    reason?.trim() || null,
    details == null ? null : JSON.stringify(details),
  );
}

function buildFormulaSnapshot(formula) {
  return JSON.stringify({
    id: formula.id,
    code: formula.code,
    name: formula.name,
    versionNo: formula.version_no,
    finishedItemId: formula.finished_item_id,
    finishedItemCode: formula.finished_item_code,
    finishedItemName: formula.finished_item_name,
    batchSize: Number(formula.batch_size),
    batchUnitId: formula.batch_unit_id,
    batchUnitCode: formula.batch_unit_code,
    entryMode: formula.entry_mode || "QUANTITY",
    compositionSize:
      formula.composition_size == null ? null : Number(formula.composition_size),
    compositionUnitId: formula.composition_unit_id || null,
    compositionUnitCode: formula.composition_unit_code || null,
    ingredients: formula.ingredients.map((ingredient) => ({
      itemId: ingredient.ingredient_item_id,
      itemCode: ingredient.ingredient_code,
      itemName: ingredient.ingredient_name,
      categoryCode: ingredient.category_code,
      quantity: Number(ingredient.quantity),
      unitId: ingredient.unit_id,
      unitCode: ingredient.unit_code,
      percentage:
        ingredient.percentage == null ? null : Number(ingredient.percentage),
    })),
  });
}

function calculateRequirementsFromFormula(formula, requiredBatchSize) {
  const requiredSize = requirePositive(requiredBatchSize, "Required batch size");
  const formulaBatchSize = requirePositive(
    formula.batch_size,
    "Formula base batch size",
  );
  const scaleFactor = requiredSize / formulaBatchSize;

  const ingredients = formula.ingredients.map((ingredient) => {
    const requiredQuantity = Number(ingredient.quantity) * scaleFactor;
    const itemBaseUnit = getItemBaseUnit(ingredient.ingredient_item_id);
    const requiredBaseQuantity = convertQuantityByUnitIds(
      requiredQuantity,
      ingredient.unit_id,
      itemBaseUnit.unitId,
    );
    const currentStockBase = Number(getItemStock(ingredient.ingredient_item_id));
    const currentStock = convertQuantityByUnitIds(
      currentStockBase,
      itemBaseUnit.unitId,
      ingredient.unit_id,
    );

    return {
      ingredientItemId: ingredient.ingredient_item_id,
      ingredientCode: ingredient.ingredient_code,
      ingredientName: ingredient.ingredient_name,
      categoryCode: ingredient.category_code,
      categoryName: ingredient.category_name,
      unitId: ingredient.unit_id,
      unitCode: ingredient.unit_code,
      baseUnitId: itemBaseUnit.unitId,
      baseUnitCode: itemBaseUnit.unitCode,
      baseQuantity: Number(ingredient.quantity),
      requiredQuantity,
      requiredBaseQuantity,
      currentStock,
      currentStockBase,
      sufficientStock: currentStockBase + EPSILON >= requiredBaseQuantity,
    };
  });

  return {
    formula,
    requiredBatchSize: requiredSize,
    scaleFactor,
    ingredients,
  };
}

export function calculateProductionRequirements(formulaId, requiredBatchSize) {
  const formula = getFormulaById(Number(formulaId));

  if (!formula) {
    throw new Error("Formula not found.");
  }

  if (Number(formula.is_active) !== 1) {
    throw new Error("Inactive formula versions cannot be used for a new production plan.");
  }

  return calculateRequirementsFromFormula(formula, requiredBatchSize);
}

function getPlanRows(batchId) {
  return db.prepare(`
    SELECT
      pc.*,
      i.code AS item_code,
      i.name AS item_name,
      i.track_lot,
      i.track_expiry,
      c.code AS category_code,
      c.name AS category_name,
      u.code AS unit_code,
      u.name AS unit_name,
      bu.code AS base_unit_code,
      bu.name AS base_unit_name
    FROM production_consumption pc
    INNER JOIN items i ON i.id = pc.item_id
    INNER JOIN item_categories c ON c.id = i.category_id
    INNER JOIN units u ON u.id = pc.unit_id
    LEFT JOIN units bu ON bu.id = pc.base_unit_id
    WHERE pc.production_batch_id = ?
    ORDER BY pc.id
  `).all(Number(batchId));
}

export function createProductionPlan(data) {
  const transaction = db.transaction(() => {
    if (!data.productionDate) {
      throw new Error("Production date is required.");
    }

    const calculation = calculateProductionRequirements(
      Number(data.formulaId),
      Number(data.plannedBatchSize),
    );
    const formula = calculation.formula;
    const batchNo = generateBatchNumber();

    const batchResult = db.prepare(`
      INSERT INTO production_batches (
        batch_no,
        production_date,
        formula_id,
        planned_batch_size,
        actual_output_qty,
        batch_unit_id,
        finished_item_id,
        notes,
        status,
        formula_snapshot_json,
        qc_status
      )
      VALUES (?, ?, ?, ?, 0, ?, ?, ?, 'DRAFT', ?, 'NOT_CHECKED')
    `).run(
      batchNo,
      data.productionDate,
      Number(data.formulaId),
      Number(data.plannedBatchSize),
      Number(formula.batch_unit_id),
      Number(formula.finished_item_id),
      data.notes?.trim() || null,
      buildFormulaSnapshot(formula),
    );

    const batchId = Number(batchResult.lastInsertRowid);

    const insertConsumption = db.prepare(`
      INSERT INTO production_consumption (
        production_batch_id,
        item_id,
        planned_quantity,
        actual_quantity,
        unit_id,
        lot_no,
        unit_cost,
        planned_base_quantity,
        actual_base_quantity,
        base_unit_id,
        base_unit_cost,
        total_cost,
        variance_quantity,
        variance_percent,
        waste_quantity,
        waste_base_quantity,
        issued_quantity,
        issued_base_quantity,
        issued_base_unit_cost,
        issued_total_cost,
        returned_quantity,
        returned_base_quantity,
        extra_quantity,
        extra_base_quantity,
        extra_cost
      )
      VALUES (?, ?, ?, 0, ?, NULL, 0, ?, 0, ?, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0)
    `);

    for (const ingredient of calculation.ingredients) {
      insertConsumption.run(
        batchId,
        ingredient.ingredientItemId,
        ingredient.requiredQuantity,
        ingredient.unitId,
        ingredient.requiredBaseQuantity,
        ingredient.baseUnitId,
      );
    }

    insertEvent(batchId, "PLANNED", null, {
      plannedBatchSize: Number(data.plannedBatchSize),
      batchUnitCode: formula.batch_unit_code,
      formulaCode: formula.code,
      formulaVersion: formula.version_no,
    });

    return {
      productionBatchId: batchId,
      batchNo,
      status: "DRAFT",
    };
  });

  return transaction();
}

export const createProductionBatch = createProductionPlan;

function issuePlannedMaterials(batch, { correction = false } = {}) {
  const rows = getPlanRows(batch.id);

  if (rows.length === 0) {
    throw new Error("Production plan has no component requirements.");
  }

  /* Validate the entire issue first so the transaction fails cleanly. */
  for (const row of rows) {
    const itemBaseUnit = getItemBaseUnit(row.item_id);
    const plannedBaseQuantity =
      Number(row.planned_base_quantity || 0) > EPSILON
        ? Number(row.planned_base_quantity)
        : convertQuantityByUnitIds(
            Number(row.planned_quantity || 0),
            Number(row.unit_id),
            itemBaseUnit.unitId,
          );

    const availableBase = Number(getItemStock(row.item_id));
    if (plannedBaseQuantity > availableBase + EPSILON) {
      const availableDisplay = convertQuantityByUnitIds(
        availableBase,
        itemBaseUnit.unitId,
        row.unit_id,
      );
      throw new Error(
        `${row.item_name}: insufficient stock to start production. Required ${Number(
          row.planned_quantity || 0,
        ).toFixed(3)} ${row.unit_code}, available ${availableDisplay.toFixed(3)} ${row.unit_code}.`,
      );
    }
  }

  let wipMaterialCost = 0;
  const issueTransactionType = correction
    ? "PRODUCTION_CORRECTION_MATERIAL_ISSUE"
    : "PRODUCTION_MATERIAL_ISSUE";

  for (const row of rows) {
    const itemBaseUnit = getItemBaseUnit(row.item_id);
    const plannedQuantity = Number(row.planned_quantity || 0);
    const plannedBaseQuantity =
      Number(row.planned_base_quantity || 0) > EPSILON
        ? Number(row.planned_base_quantity)
        : convertQuantityByUnitIds(
            plannedQuantity,
            Number(row.unit_id),
            itemBaseUnit.unitId,
          );

    let issueBaseUnitCost = 0;
    let issueTotalCost = 0;

    if (plannedBaseQuantity > EPSILON) {
      const costResult = removeInventoryValue(row.item_id, plannedBaseQuantity);
      issueBaseUnitCost = Number(costResult.unitCost || 0);
      issueTotalCost = Number(costResult.valueRemoved || 0);
      wipMaterialCost += issueTotalCost;

      addStockTransaction({
        transactionDate: batch.production_date,
        itemId: row.item_id,
        transactionType: issueTransactionType,
        referenceType: "PRODUCTION",
        referenceId: batch.id,
        referenceNo: batch.batch_no,
        quantityIn: 0,
        quantityOut: plannedBaseQuantity,
        unitCost: issueBaseUnitCost,
        lotNo: row.lot_no || null,
        expiryDate: null,
        notes: correction
          ? `Re-issued for correction of ${batch.batch_no}`
          : `Issued to WIP for ${batch.batch_no}`,
      });
    }

    db.prepare(`
      UPDATE production_consumption
      SET
        planned_base_quantity = ?,
        base_unit_id = ?,
        issued_quantity = ?,
        issued_base_quantity = ?,
        issued_base_unit_cost = ?,
        issued_total_cost = ?,
        actual_quantity = 0,
        actual_base_quantity = 0,
        base_unit_cost = 0,
        total_cost = 0,
        variance_quantity = 0,
        variance_percent = 0,
        waste_quantity = 0,
        waste_base_quantity = 0,
        returned_quantity = 0,
        returned_base_quantity = 0,
        extra_quantity = 0,
        extra_base_quantity = 0,
        extra_cost = 0,
        unit_cost = 0
      WHERE id = ?
    `).run(
      plannedBaseQuantity,
      itemBaseUnit.unitId,
      plannedQuantity,
      plannedBaseQuantity,
      issueBaseUnitCost,
      issueTotalCost,
      row.id,
    );
  }

  db.prepare(`
    UPDATE production_batches
    SET
      status = 'IN_PRODUCTION',
      started_at = COALESCE(started_at, CURRENT_TIMESTAMP),
      wip_material_cost = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(wipMaterialCost, batch.id);

  return { wipMaterialCost };
}

export function startProductionBatch(id, data = {}) {
  const transaction = db.transaction(() => {
    const batch = getBatchOrThrow(id);

    if (batch.status === "IN_PRODUCTION") {
      return {
        id: batch.id,
        batchNo: batch.batch_no,
        status: batch.status,
        wipMaterialCost: Number(batch.wip_material_cost || 0),
      };
    }

    if (batch.status !== "DRAFT") {
      throw new Error("Only a draft production batch can be started.");
    }

    const submittedLots = new Map(
      (data.ingredients || []).map((line) => [
        Number(line.itemId),
        String(line.lotNo || "").trim(),
      ]),
    );

    const planRows = getPlanRows(batch.id);
    for (const row of planRows) {
      const lotNo = submittedLots.has(Number(row.item_id))
        ? submittedLots.get(Number(row.item_id))
        : String(row.lot_no || "").trim();

      if (Number(row.track_lot || 0) === 1 && !lotNo) {
        throw new Error(`${row.item_name}: lot number is required before material issue.`);
      }

      db.prepare(`
        UPDATE production_consumption
        SET lot_no = ?
        WHERE id = ?
      `).run(lotNo || null, row.id);
    }

    const result = issuePlannedMaterials(batch);

    insertEvent(batch.id, "STARTED", null, {
      wipMaterialCost: result.wipMaterialCost,
    });

    return {
      id: batch.id,
      batchNo: batch.batch_no,
      status: "IN_PRODUCTION",
      wipMaterialCost: result.wipMaterialCost,
    };
  });

  return transaction();
}

function validateOutcome(data, batch) {
  const goodOutputQty = requireNonNegative(data.goodOutputQty, "Good output");
  const rejectedQty = requireNonNegative(data.rejectedQty, "Rejected quantity");
  const reworkQty = requireNonNegative(data.reworkQty, "Rework quantity");
  const scrapQty = requireNonNegative(data.scrapQty, "Scrap quantity");
  const totalOutcomeQty = goodOutputQty + rejectedQty + reworkQty + scrapQty;

  if (totalOutcomeQty <= 0) {
    throw new Error(
      "Enter at least one production outcome: good, rejected, rework or scrap quantity.",
    );
  }

  const planned = Number(batch.planned_batch_size || 0);
  const outputVarianceQty = goodOutputQty - planned;
  const outputVariancePercent = planned > 0 ? (outputVarianceQty / planned) * 100 : 0;
  const yieldPercent = planned > 0 ? (goodOutputQty / planned) * 100 : 0;

  return {
    goodOutputQty,
    rejectedQty,
    reworkQty,
    scrapQty,
    totalOutcomeQty,
    outputVarianceQty,
    outputVariancePercent,
    yieldPercent,
  };
}

function applyCompletion(batch, data, { correction = false } = {}) {
  if (batch.status !== "IN_PRODUCTION") {
    throw new Error("Start the production batch before entering final actuals.");
  }

  const outcome = validateOutcome(data, batch);
  const rows = getPlanRows(batch.id);

  const submitted = new Map();
  for (const line of data.ingredients || []) {
    const itemId = Number(line.itemId);
    if (!itemId) {
      throw new Error("A production component is missing its item reference.");
    }
    if (submitted.has(itemId)) {
      throw new Error("The same production component cannot be submitted twice.");
    }
    submitted.set(itemId, line);
  }

  /* Validate all actuals and all extra stock before mutating inventory. */
  for (const row of rows) {
    const line = submitted.get(Number(row.item_id));
    if (!line) {
      throw new Error(`${row.item_name}: actual production quantity is required.`);
    }

    const actualQuantity = requireNonNegative(
      line.actualQuantity,
      `${row.item_name} actual consumption`,
    );
    const wasteQuantity = requireNonNegative(
      line.wasteQuantity,
      `${row.item_name} waste quantity`,
    );

    if (wasteQuantity > actualQuantity + EPSILON) {
      throw new Error(`${row.item_name}: waste cannot exceed actual consumption.`);
    }

    const itemBaseUnit = getItemBaseUnit(row.item_id);
    const actualBaseQuantity = convertQuantityByUnitIds(
      actualQuantity,
      row.unit_id,
      itemBaseUnit.unitId,
    );
    const issuedBaseQuantity = Number(row.issued_base_quantity || 0);

    if (issuedBaseQuantity <= EPSILON && Number(row.planned_quantity || 0) > EPSILON) {
      throw new Error(`${row.item_name}: planned material was not issued. Start the batch again.`);
    }

    const extraBaseQuantity = Math.max(0, actualBaseQuantity - issuedBaseQuantity);
    if (extraBaseQuantity > EPSILON) {
      const availableBase = Number(getItemStock(row.item_id));
      if (extraBaseQuantity > availableBase + EPSILON) {
        const availableDisplay = convertQuantityByUnitIds(
          availableBase,
          itemBaseUnit.unitId,
          row.unit_id,
        );
        const extraDisplay = convertQuantityByUnitIds(
          extraBaseQuantity,
          itemBaseUnit.unitId,
          row.unit_id,
        );
        throw new Error(
          `${row.item_name}: extra consumption of ${extraDisplay.toFixed(3)} ${row.unit_code} exceeds currently available stock of ${availableDisplay.toFixed(3)} ${row.unit_code}.`,
        );
      }
    }
  }

  let materialCost = 0;
  const returnTransactionType = correction
    ? "PRODUCTION_CORRECTION_MATERIAL_RETURN"
    : "PRODUCTION_MATERIAL_RETURN";
  const extraTransactionType = correction
    ? "PRODUCTION_CORRECTION_EXTRA_CONSUMPTION"
    : "PRODUCTION_EXTRA_CONSUMPTION";

  for (const row of rows) {
    const line = submitted.get(Number(row.item_id));
    const actualQuantity = Number(line.actualQuantity || 0);
    const wasteQuantity = Number(line.wasteQuantity || 0);
    const itemBaseUnit = getItemBaseUnit(row.item_id);

    const actualBaseQuantity = convertQuantityByUnitIds(
      actualQuantity,
      row.unit_id,
      itemBaseUnit.unitId,
    );
    const wasteBaseQuantity = convertQuantityByUnitIds(
      wasteQuantity,
      row.unit_id,
      itemBaseUnit.unitId,
    );

    const issuedQuantity = Number(row.issued_quantity || row.planned_quantity || 0);
    const issuedBaseQuantity = Number(row.issued_base_quantity || 0);
    const issuedBaseUnitCost = Number(row.issued_base_unit_cost || 0);
    const issuedTotalCost = Number(row.issued_total_cost || 0);

    const returnedBaseQuantity = Math.max(0, issuedBaseQuantity - actualBaseQuantity);
    const extraBaseQuantity = Math.max(0, actualBaseQuantity - issuedBaseQuantity);

    let returnedQuantity = 0;
    let returnedValue = 0;
    let extraQuantity = 0;
    let extraCost = 0;

    if (returnedBaseQuantity > EPSILON) {
      returnedQuantity = convertQuantityByUnitIds(
        returnedBaseQuantity,
        itemBaseUnit.unitId,
        row.unit_id,
      );
      returnedValue = returnedBaseQuantity * issuedBaseUnitCost;

      addInventoryValue(row.item_id, returnedBaseQuantity, issuedBaseUnitCost);
      addStockTransaction({
        transactionDate: batch.production_date,
        itemId: row.item_id,
        transactionType: returnTransactionType,
        referenceType: "PRODUCTION",
        referenceId: batch.id,
        referenceNo: batch.batch_no,
        quantityIn: returnedBaseQuantity,
        quantityOut: 0,
        unitCost: issuedBaseUnitCost,
        lotNo: line.lotNo?.trim() || row.lot_no || null,
        expiryDate: null,
        notes: correction
          ? `Unused material returned during correction of ${batch.batch_no}`
          : `Unused material returned from ${batch.batch_no}`,
      });
    }

    if (extraBaseQuantity > EPSILON) {
      extraQuantity = convertQuantityByUnitIds(
        extraBaseQuantity,
        itemBaseUnit.unitId,
        row.unit_id,
      );
      const extraCostResult = removeInventoryValue(row.item_id, extraBaseQuantity);
      extraCost = Number(extraCostResult.valueRemoved || 0);

      addStockTransaction({
        transactionDate: batch.production_date,
        itemId: row.item_id,
        transactionType: extraTransactionType,
        referenceType: "PRODUCTION",
        referenceId: batch.id,
        referenceNo: batch.batch_no,
        quantityIn: 0,
        quantityOut: extraBaseQuantity,
        unitCost: Number(extraCostResult.unitCost || 0),
        lotNo: line.lotNo?.trim() || row.lot_no || null,
        expiryDate: null,
        notes: correction
          ? `Extra material consumed during correction of ${batch.batch_no}`
          : `Extra material consumed in ${batch.batch_no}`,
      });
    }

    const totalCost = Math.max(0, issuedTotalCost - returnedValue + extraCost);
    const effectiveBaseUnitCost =
      actualBaseQuantity > EPSILON ? totalCost / actualBaseQuantity : 0;
    materialCost += totalCost;

    const displayUnit = getUnitById(row.unit_id);
    const baseUnit = getUnitById(itemBaseUnit.unitId);
    const oneDisplayUnitInBase = convertQuantity(
      1,
      displayUnit.code,
      baseUnit.code,
    );
    const displayUnitCost = effectiveBaseUnitCost * oneDisplayUnitInBase;

    const plannedQuantity = Number(row.planned_quantity || 0);
    const varianceQuantity = actualQuantity - plannedQuantity;
    const variancePercent =
      plannedQuantity > 0 ? (varianceQuantity / plannedQuantity) * 100 : 0;

    db.prepare(`
      UPDATE production_consumption
      SET
        actual_quantity = ?,
        lot_no = ?,
        unit_cost = ?,
        actual_base_quantity = ?,
        base_unit_id = ?,
        base_unit_cost = ?,
        total_cost = ?,
        variance_quantity = ?,
        variance_percent = ?,
        waste_quantity = ?,
        waste_base_quantity = ?,
        returned_quantity = ?,
        returned_base_quantity = ?,
        extra_quantity = ?,
        extra_base_quantity = ?,
        extra_cost = ?
      WHERE id = ?
    `).run(
      actualQuantity,
      line.lotNo?.trim() || null,
      displayUnitCost,
      actualBaseQuantity,
      itemBaseUnit.unitId,
      effectiveBaseUnitCost,
      totalCost,
      varianceQuantity,
      variancePercent,
      wasteQuantity,
      wasteBaseQuantity,
      returnedQuantity,
      returnedBaseQuantity,
      extraQuantity,
      extraBaseQuantity,
      extraCost,
      row.id,
    );
  }

  const labourCost = requireNonNegative(data.labourCost, "Direct labour cost");
  const electricityCost = requireNonNegative(
    data.electricityCost,
    "Electricity / utilities cost",
  );
  const otherOverheadCost = requireNonNegative(
    data.otherOverheadCost,
    "Other manufacturing cost",
  );
  const totalOverheadCost = labourCost + electricityCost + otherOverheadCost;
  const totalProductionCost = materialCost + totalOverheadCost;

  const finishedTracking = db.prepare(`
    SELECT track_lot, track_expiry
    FROM items
    WHERE id = ?
  `).get(batch.finished_item_id);

  if (outcome.goodOutputQty > EPSILON) {
    if (Number(finishedTracking?.track_lot || 0) === 1 && !String(data.finishedLotNo || "").trim()) {
      throw new Error("Finished product lot / batch number is required.");
    }
    if (Number(finishedTracking?.track_expiry || 0) === 1 && !data.expiryDate) {
      throw new Error("Finished product expiry date is required.");
    }
  }

  const finishedBaseUnit = getItemBaseUnit(batch.finished_item_id);
  const goodOutputBaseQty =
    outcome.goodOutputQty > EPSILON
      ? convertQuantityByUnitIds(
          outcome.goodOutputQty,
          batch.batch_unit_id,
          finishedBaseUnit.unitId,
        )
      : 0;
  const finishedUnitCost =
    goodOutputBaseQty > EPSILON ? totalProductionCost / goodOutputBaseQty : 0;
  const manufacturingLossCost =
    goodOutputBaseQty > EPSILON ? 0 : totalProductionCost;

  const pricing = db.prepare(`
    SELECT
      default_selling_price,
      target_margin_percent
    FROM items
    WHERE id = ?
  `).get(batch.finished_item_id);

  const sellingPriceSnapshot = Number(
    pricing?.default_selling_price || 0,
  );
  const targetMarginPercentSnapshot = Number(
    pricing?.target_margin_percent || 0,
  );
  const suggestedSellingPrice =
    goodOutputBaseQty > EPSILON &&
    targetMarginPercentSnapshot > 0 &&
    targetMarginPercentSnapshot < 100
      ? finishedUnitCost / (1 - targetMarginPercentSnapshot / 100)
      : 0;

  if (goodOutputBaseQty > EPSILON) {
    addInventoryValue(batch.finished_item_id, goodOutputBaseQty, finishedUnitCost);
    addStockTransaction({
      transactionDate: batch.production_date,
      itemId: batch.finished_item_id,
      transactionType: correction
        ? "PRODUCTION_CORRECTION_OUTPUT"
        : "PRODUCTION_OUTPUT",
      referenceType: "PRODUCTION",
      referenceId: batch.id,
      referenceNo: batch.batch_no,
      quantityIn: goodOutputBaseQty,
      quantityOut: 0,
      unitCost: finishedUnitCost,
      lotNo: data.finishedLotNo?.trim() || null,
      expiryDate: data.expiryDate || null,
      notes: correction
        ? `Corrected good output for ${batch.batch_no}`
        : `Good output produced in ${batch.batch_no}`,
    });
  }

  db.prepare(`
    UPDATE production_batches
    SET
      actual_output_qty = ?,
      good_output_qty = ?,
      rejected_qty = ?,
      rework_qty = ?,
      scrap_qty = ?,
      total_outcome_qty = ?,
      output_variance_qty = ?,
      output_variance_percent = ?,
      yield_percent = ?,
      material_cost = ?,
      labour_cost = ?,
      electricity_cost = ?,
      other_overhead_cost = ?,
      total_production_cost = ?,
      finished_unit_cost = ?,
      manufacturing_loss_cost = ?,
      selling_price_snapshot = ?,
      target_margin_percent_snapshot = ?,
      suggested_selling_price = ?,
      wip_material_cost = 0,
      finished_lot_no = ?,
      mfg_date = ?,
      expiry_date = ?,
      notes = ?,
      status = 'COMPLETED',
      completed_at = CURRENT_TIMESTAMP,
      closed_at = NULL,
      qc_status = 'NOT_CHECKED',
      qc_checked_at = NULL,
      qc_notes = NULL,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(
    outcome.goodOutputQty,
    outcome.goodOutputQty,
    outcome.rejectedQty,
    outcome.reworkQty,
    outcome.scrapQty,
    outcome.totalOutcomeQty,
    outcome.outputVarianceQty,
    outcome.outputVariancePercent,
    outcome.yieldPercent,
    materialCost,
    labourCost,
    electricityCost,
    otherOverheadCost,
    totalProductionCost,
    finishedUnitCost,
    manufacturingLossCost,
    sellingPriceSnapshot,
    targetMarginPercentSnapshot,
    suggestedSellingPrice,
    data.finishedLotNo?.trim() || null,
    data.mfgDate || null,
    data.expiryDate || null,
    data.notes?.trim() || null,
    batch.id,
  );

  return {
    productionBatchId: batch.id,
    batchNo: batch.batch_no,
    status: "COMPLETED",
    ...outcome,
    materialCost,
    labourCost,
    electricityCost,
    otherOverheadCost,
    totalOverheadCost,
    totalProductionCost,
    finishedUnitCost,
    manufacturingLossCost,
    sellingPriceSnapshot,
    targetMarginPercentSnapshot,
    suggestedSellingPrice,
    actualOutputQty: outcome.goodOutputQty,
    actualOutputUnit: getUnitById(batch.batch_unit_id).code,
    actualOutputBaseQty: goodOutputBaseQty,
    finishedBaseUnit: finishedBaseUnit.unitCode,
  };
}

export function completeProductionBatch(id, data) {
  const transaction = db.transaction(() => {
    const batch = getBatchOrThrow(id);

    if (batch.status !== "IN_PRODUCTION") {
      throw new Error("Start the production batch before completing it.");
    }

    const result = applyCompletion(batch, data);

    insertEvent(batch.id, "COMPLETED", null, {
      goodOutputQty: result.goodOutputQty,
      rejectedQty: result.rejectedQty,
      reworkQty: result.reworkQty,
      scrapQty: result.scrapQty,
      yieldPercent: result.yieldPercent,
      totalProductionCost: result.totalProductionCost,
      finishedUnitCost: result.finishedUnitCost,
    });

    return result;
  });

  return transaction();
}

function getLatestOutputTransaction(batchId, finishedItemId) {
  return db.prepare(`
    SELECT *
    FROM stock_transactions
    WHERE reference_type = 'PRODUCTION'
      AND reference_id = ?
      AND item_id = ?
      AND transaction_type IN ('PRODUCTION_OUTPUT', 'PRODUCTION_CORRECTION_OUTPUT')
      AND quantity_in > 0
    ORDER BY id DESC
    LIMIT 1
  `).get(Number(batchId), Number(finishedItemId));
}

function getLatestIssueTransaction(batchId, itemId) {
  return db.prepare(`
    SELECT *
    FROM stock_transactions
    WHERE reference_type = 'PRODUCTION'
      AND reference_id = ?
      AND item_id = ?
      AND transaction_type IN (
        'PRODUCTION_MATERIAL_ISSUE',
        'PRODUCTION_CORRECTION_MATERIAL_ISSUE'
      )
      AND quantity_out > 0
    ORDER BY id DESC
    LIMIT 1
  `).get(Number(batchId), Number(itemId));
}

function assertNoLaterMovement(itemId, transactionId, message) {
  const later = db.prepare(`
    SELECT id, transaction_type, reference_no
    FROM stock_transactions
    WHERE item_id = ?
      AND id > ?
    ORDER BY id
    LIMIT 1
  `).get(Number(itemId), Number(transactionId));

  if (later) throw new Error(message);
}

function assertNoExternalMovementAfterIssue(batchId, itemId, transactionId, message) {
  const later = db.prepare(`
    SELECT id, transaction_type, reference_no
    FROM stock_transactions
    WHERE item_id = ?
      AND id > ?
      AND NOT (
        reference_type = 'PRODUCTION'
        AND reference_id = ?
      )
    ORDER BY id
    LIMIT 1
  `).get(Number(itemId), Number(transactionId), Number(batchId));

  if (later) throw new Error(message);
}

function restoreIssuedWip(batch, { correction = false } = {}) {
  const rows = getPlanRows(batch.id);
  let restoredValue = 0;

  for (const row of rows) {
    const issuedBaseQuantity = Number(row.issued_base_quantity || 0);
    const issuedBaseUnitCost = Number(row.issued_base_unit_cost || 0);
    if (issuedBaseQuantity <= EPSILON) continue;

    addInventoryValue(row.item_id, issuedBaseQuantity, issuedBaseUnitCost);
    restoredValue += issuedBaseQuantity * issuedBaseUnitCost;

    addStockTransaction({
      transactionDate: new Date().toISOString().slice(0, 10),
      itemId: row.item_id,
      transactionType: correction
        ? "PRODUCTION_CORRECTION_REVERSAL_WIP"
        : "PRODUCTION_CANCEL_WIP_RETURN",
      referenceType: "PRODUCTION",
      referenceId: batch.id,
      referenceNo: batch.batch_no,
      quantityIn: issuedBaseQuantity,
      quantityOut: 0,
      unitCost: issuedBaseUnitCost,
      lotNo: row.lot_no || null,
      expiryDate: null,
      notes: correction
        ? `WIP issue reversed before correcting ${batch.batch_no}`
        : `Unused WIP restored from cancelled ${batch.batch_no}`,
    });
  }

  return restoredValue;
}

function reverseCompletedMovements(batch, { strictCorrection = false } = {}) {
  const outputTransaction = getLatestOutputTransaction(
    batch.id,
    batch.finished_item_id,
  );
  const goodOutputQty = Number(
    batch.good_output_qty || batch.actual_output_qty || 0,
  );
  const finishedBaseUnit = getItemBaseUnit(batch.finished_item_id);
  const goodOutputBaseQty =
    goodOutputQty > EPSILON
      ? convertQuantityByUnitIds(
          goodOutputQty,
          batch.batch_unit_id,
          finishedBaseUnit.unitId,
        )
      : 0;

  if (goodOutputBaseQty > EPSILON) {
    if (!outputTransaction) {
      throw new Error("Original production output costing transaction was not found.");
    }

    const finishedStock = Number(getItemStock(batch.finished_item_id));
    if (goodOutputBaseQty > finishedStock + EPSILON) {
      throw new Error(
        "Production cannot be reversed because the produced finished stock is no longer fully available.",
      );
    }

    if (strictCorrection) {
      assertNoLaterMovement(
        batch.finished_item_id,
        outputTransaction.id,
        "This batch cannot be corrected because the finished product has later stock movements. Use a controlled stock/cost adjustment instead.",
      );
    } else {
      const laterOutgoing = db.prepare(`
        SELECT id
        FROM stock_transactions
        WHERE item_id = ?
          AND id > ?
          AND quantity_out > 0
        ORDER BY id
        LIMIT 1
      `).get(batch.finished_item_id, outputTransaction.id);

      if (laterOutgoing) {
        throw new Error(
          "Production batch cannot be cancelled because the produced item has subsequent stock usage. Use a stock adjustment/return workflow instead.",
        );
      }
    }
  }

  const rows = getPlanRows(batch.id);

  if (strictCorrection) {
    for (const row of rows) {
      const issueTransaction = getLatestIssueTransaction(batch.id, row.item_id);
      if (!issueTransaction && Number(row.actual_base_quantity || 0) > EPSILON) {
        throw new Error(`${row.item_name}: material issue history was not found.`);
      }
      if (issueTransaction) {
        assertNoExternalMovementAfterIssue(
          batch.id,
          row.item_id,
          issueTransaction.id,
          `${row.item_name}: this batch cannot be corrected because this component has external stock movements after it was issued. Use a stock adjustment instead.`,
        );
      }
    }
  }

  if (goodOutputBaseQty > EPSILON) {
    reverseInventoryReceipt(
      batch.finished_item_id,
      goodOutputBaseQty,
      Number(outputTransaction.unit_cost || 0),
    );

    addStockTransaction({
      transactionDate: new Date().toISOString().slice(0, 10),
      itemId: batch.finished_item_id,
      transactionType: strictCorrection
        ? "PRODUCTION_CORRECTION_REVERSAL_OUTPUT"
        : "PRODUCTION_CANCEL_OUTPUT",
      referenceType: "PRODUCTION",
      referenceId: batch.id,
      referenceNo: batch.batch_no,
      quantityIn: 0,
      quantityOut: goodOutputBaseQty,
      unitCost: Number(outputTransaction.unit_cost || 0),
      lotNo: batch.finished_lot_no || null,
      expiryDate: batch.expiry_date || null,
      notes: strictCorrection
        ? `Finished output reversed before correcting ${batch.batch_no}`
        : `Cancellation of output for ${batch.batch_no}`,
    });
  }

  for (const row of rows) {
    const actualBaseQuantity = Number(row.actual_base_quantity || 0);
    const totalCost = Number(row.total_cost || 0);

    if (actualBaseQuantity <= EPSILON) continue;

    const effectiveBaseCost =
      totalCost > 0
        ? totalCost / actualBaseQuantity
        : Number(row.base_unit_cost || 0);

    addInventoryValue(row.item_id, actualBaseQuantity, effectiveBaseCost);

    addStockTransaction({
      transactionDate: new Date().toISOString().slice(0, 10),
      itemId: row.item_id,
      transactionType: strictCorrection
        ? "PRODUCTION_CORRECTION_REVERSAL_CONSUMPTION"
        : "PRODUCTION_CANCEL_CONSUMPTION",
      referenceType: "PRODUCTION",
      referenceId: batch.id,
      referenceNo: batch.batch_no,
      quantityIn: actualBaseQuantity,
      quantityOut: 0,
      unitCost: effectiveBaseCost,
      lotNo: row.lot_no || null,
      expiryDate: null,
      notes: strictCorrection
        ? `Actual consumption reversed before correcting ${batch.batch_no}`
        : `Consumed material restored from cancelled ${batch.batch_no}`,
    });
  }
}

export function correctProductionBatch(id, data) {
  const transaction = db.transaction(() => {
    const batch = getBatchOrThrow(id);

    if (batch.status !== "COMPLETED") {
      throw new Error("Only a completed, not-yet-closed batch can be corrected.");
    }

    const reason = String(data.correctionReason || "").trim();
    if (!reason) {
      throw new Error("Correction reason is required.");
    }

    reverseCompletedMovements(batch, { strictCorrection: true });

    const correctedLots = new Map(
      (data.ingredients || []).map((line) => [
        Number(line.itemId),
        String(line.lotNo || "").trim(),
      ]),
    );
    for (const row of getPlanRows(batch.id)) {
      if (!correctedLots.has(Number(row.item_id))) continue;
      const lotNo = correctedLots.get(Number(row.item_id));
      if (Number(row.track_lot || 0) === 1 && !lotNo) {
        throw new Error(`${row.item_name}: lot number is required for correction.`);
      }
      db.prepare(`UPDATE production_consumption SET lot_no = ? WHERE id = ?`)
        .run(lotNo || null, row.id);
    }

    /* Recreate the WIP issue from the original plan, then apply corrected actuals. */
    db.prepare(`
      UPDATE production_batches
      SET
        status = 'DRAFT',
        wip_material_cost = 0,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(batch.id);

    const resetBatch = getBatchOrThrow(batch.id);
    issuePlannedMaterials(resetBatch, { correction: true });
    const inProductionBatch = getBatchOrThrow(batch.id);
    const result = applyCompletion(inProductionBatch, data, { correction: true });

    db.prepare(`
      UPDATE production_batches
      SET
        correction_count = correction_count + 1,
        last_correction_reason = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(reason, batch.id);

    insertEvent(batch.id, "CORRECTED", reason, {
      goodOutputQty: result.goodOutputQty,
      rejectedQty: result.rejectedQty,
      reworkQty: result.reworkQty,
      scrapQty: result.scrapQty,
      totalProductionCost: result.totalProductionCost,
      finishedUnitCost: result.finishedUnitCost,
    });

    return {
      ...result,
      correctionReason: reason,
      correctionCount: Number(batch.correction_count || 0) + 1,
    };
  });

  return transaction();
}

export function updateProductionQc(id, data) {
  const transaction = db.transaction(() => {
    const batch = getBatchOrThrow(id);

    if (batch.status !== "COMPLETED") {
      throw new Error("QC can be updated only for a completed batch before it is closed.");
    }

    const qcStatus = String(data.qcStatus || "").trim().toUpperCase();
    if (!QC_STATUSES.has(qcStatus)) {
      throw new Error("QC status must be NOT_CHECKED, PASSED or FAILED.");
    }

    db.prepare(`
      UPDATE production_batches
      SET
        qc_status = ?,
        qc_checked_at = CASE
          WHEN ? = 'NOT_CHECKED' THEN NULL
          ELSE CURRENT_TIMESTAMP
        END,
        qc_notes = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      qcStatus,
      qcStatus,
      data.qcNotes?.trim() || null,
      batch.id,
    );

    insertEvent(batch.id, "QC_UPDATED", data.qcNotes?.trim() || null, {
      qcStatus,
    });

    return { id: batch.id, batchNo: batch.batch_no, qcStatus };
  });

  return transaction();
}

export function closeProductionBatch(id) {
  const transaction = db.transaction(() => {
    const batch = getBatchOrThrow(id);

    if (batch.status !== "COMPLETED") {
      throw new Error("Only a completed production batch can be closed.");
    }

    if (batch.qc_status === "FAILED") {
      throw new Error("A batch with failed QC cannot be closed. Correct/rework the batch first.");
    }

    db.prepare(`
      UPDATE production_batches
      SET
        status = 'CLOSED',
        closed_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(batch.id);

    insertEvent(batch.id, "CLOSED");

    return { id: batch.id, batchNo: batch.batch_no, status: "CLOSED" };
  });

  return transaction();
}

export function getProductionBatches() {
  return db.prepare(`
    SELECT
      pb.id,
      pb.batch_no,
      pb.production_date,
      pb.planned_batch_size,
      pb.actual_output_qty,
      pb.good_output_qty,
      pb.rejected_qty,
      pb.rework_qty,
      pb.scrap_qty,
      pb.total_outcome_qty,
      pb.output_variance_qty,
      pb.output_variance_percent,
      pb.yield_percent,
      pb.finished_lot_no,
      pb.mfg_date,
      pb.expiry_date,
      pb.status,
      pb.qc_status,
      pb.correction_count,
      pb.wip_material_cost,
      pb.material_cost,
      pb.labour_cost,
      pb.electricity_cost,
      pb.other_overhead_cost,
      pb.total_production_cost,
      pb.finished_unit_cost,
      pb.manufacturing_loss_cost,
      pb.created_at,
      pb.started_at,
      pb.completed_at,
      pb.closed_at,
      f.code AS formula_code,
      f.name AS formula_name,
      f.version_no,
      i.code AS finished_item_code,
      i.name AS finished_item_name,
      i.track_lot AS finished_track_lot,
      i.track_expiry AS finished_track_expiry,
      u.code AS batch_unit_code
    FROM production_batches pb
    INNER JOIN formulas f ON f.id = pb.formula_id
    INNER JOIN items i ON i.id = pb.finished_item_id
    INNER JOIN units u ON u.id = pb.batch_unit_id
    ORDER BY pb.production_date DESC, pb.id DESC
  `).all();
}

export function getOpenProductionBatches() {
  return db.prepare(`
    SELECT
      pb.id,
      pb.batch_no,
      pb.production_date,
      pb.planned_batch_size,
      pb.status,
      pb.started_at,
      pb.wip_material_cost,
      f.code AS formula_code,
      f.name AS formula_name,
      f.version_no,
      i.code AS finished_item_code,
      i.name AS finished_item_name,
      i.track_lot AS finished_track_lot,
      i.track_expiry AS finished_track_expiry,
      u.code AS batch_unit_code
    FROM production_batches pb
    INNER JOIN formulas f ON f.id = pb.formula_id
    INNER JOIN items i ON i.id = pb.finished_item_id
    INNER JOIN units u ON u.id = pb.batch_unit_id
    WHERE pb.status IN ('DRAFT', 'IN_PRODUCTION')
    ORDER BY pb.production_date DESC, pb.id DESC
  `).all();
}

export function getProductionBatchById(id) {
  const batch = db.prepare(`
    SELECT
      pb.*,
      f.code AS formula_code,
      f.name AS formula_name,
      f.version_no,
      i.code AS finished_item_code,
      i.name AS finished_item_name,
      i.track_lot AS finished_track_lot,
      i.track_expiry AS finished_track_expiry,
      u.code AS batch_unit_code
    FROM production_batches pb
    INNER JOIN formulas f ON f.id = pb.formula_id
    INNER JOIN items i ON i.id = pb.finished_item_id
    INNER JOIN units u ON u.id = pb.batch_unit_id
    WHERE pb.id = ?
  `).get(Number(id));

  if (!batch) return null;

  const consumption = getPlanRows(batch.id).map((row) => {
    const itemBaseUnit = getItemBaseUnit(row.item_id);
    const plannedBaseQuantity =
      Number(row.planned_base_quantity || 0) > EPSILON
        ? Number(row.planned_base_quantity)
        : convertQuantityByUnitIds(
            Number(row.planned_quantity || 0),
            Number(row.unit_id),
            itemBaseUnit.unitId,
          );
    const currentStockBase = Number(getItemStock(row.item_id));
    const currentStockDisplay = convertQuantityByUnitIds(
      currentStockBase,
      itemBaseUnit.unitId,
      row.unit_id,
    );

    return {
      ...row,
      planned_base_quantity: plannedBaseQuantity,
      base_unit_id: Number(row.base_unit_id || itemBaseUnit.unitId),
      base_unit_code: row.base_unit_code || itemBaseUnit.unitCode,
      current_stock_base: currentStockBase,
      current_stock_display: currentStockDisplay,
    };
  });

  const events = db.prepare(`
    SELECT id, event_type, event_date, reason, details_json
    FROM production_batch_events
    WHERE production_batch_id = ?
    ORDER BY id DESC
  `).all(batch.id).map((event) => ({
    ...event,
    details: (() => {
      try {
        return event.details_json ? JSON.parse(event.details_json) : null;
      } catch {
        return null;
      }
    })(),
  }));

  return { ...batch, consumption, events };
}

export function cancelProductionBatch(id) {
  const transaction = db.transaction(() => {
    const batch = getBatchOrThrow(id);

    if (batch.status === "CANCELLED") {
      throw new Error("Production batch is already cancelled.");
    }

    if (batch.status === "CLOSED") {
      throw new Error("Closed production batches cannot be cancelled directly.");
    }

    if (batch.status === "DRAFT") {
      db.prepare(`
        UPDATE production_batches
        SET status = 'CANCELLED', updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(batch.id);

      insertEvent(batch.id, "CANCELLED", "Production plan cancelled before material issue.");
      return { id: batch.id, batchNo: batch.batch_no, status: "CANCELLED" };
    }

    if (batch.status === "IN_PRODUCTION") {
      restoreIssuedWip(batch);
      db.prepare(`
        UPDATE production_batches
        SET
          status = 'CANCELLED',
          wip_material_cost = 0,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(batch.id);

      insertEvent(batch.id, "CANCELLED", "In-production WIP material issue reversed.");
      return { id: batch.id, batchNo: batch.batch_no, status: "CANCELLED" };
    }

    if (batch.status !== "COMPLETED") {
      throw new Error("This production batch cannot be cancelled in its current status.");
    }

    reverseCompletedMovements(batch);

    db.prepare(`
      UPDATE production_batches
      SET status = 'CANCELLED', updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(batch.id);

    insertEvent(batch.id, "CANCELLED", "Completed production stock movements reversed.");

    return { id: batch.id, batchNo: batch.batch_no, status: "CANCELLED" };
  });

  return transaction();
}
