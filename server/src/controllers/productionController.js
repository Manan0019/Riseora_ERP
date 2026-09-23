import {
  calculateProductionRequirements,
  createProductionPlan,
  startProductionBatch,
  completeProductionBatch,
  correctProductionBatch,
  updateProductionQc,
  closeProductionBatch,
  getProductionBatches,
  getOpenProductionBatches,
  getProductionBatchById,
  cancelProductionBatch,
} from "../services/productionService.js";

export function calculateProduction(req, res) {
  try {
    const { formulaId, batchSize } = req.query;

    if (!formulaId) {
      return res.status(400).json({ success: false, message: "Formula is required." });
    }

    if (Number(batchSize) <= 0) {
      return res.status(400).json({
        success: false,
        message: "Batch size must be greater than zero.",
      });
    }

    const result = calculateProductionRequirements(
      Number(formulaId),
      Number(batchSize),
    );

    return res.json({ success: true, calculation: result });
  } catch (error) {
    console.error("Production calculation error:", error);
    return res.status(400).json({ success: false, message: error.message });
  }
}

export function addProductionPlan(req, res) {
  try {
    const { productionDate, formulaId, plannedBatchSize } = req.body;

    if (!productionDate) {
      return res.status(400).json({
        success: false,
        message: "Production date is required.",
      });
    }

    if (!formulaId) {
      return res.status(400).json({ success: false, message: "Formula is required." });
    }

    if (Number(plannedBatchSize) <= 0) {
      return res.status(400).json({
        success: false,
        message: "Planned batch size must be greater than zero.",
      });
    }

    const production = createProductionPlan(req.body);

    return res.status(201).json({
      success: true,
      message: "Production plan created successfully.",
      production,
    });
  } catch (error) {
    console.error("Production plan error:", error);
    return res.status(400).json({
      success: false,
      message: error.message || "Unable to create production plan.",
    });
  }
}

/* Backward-compatible controller name. */
export const addProduction = addProductionPlan;

export function startProduction(req, res) {
  try {
    const result = startProductionBatch(Number(req.params.id), req.body);
    return res.json({
      success: true,
      message: "Production batch started.",
      batch: result,
    });
  } catch (error) {
    console.error("Production start error:", error);
    return res.status(400).json({ success: false, message: error.message });
  }
}

export function completeProduction(req, res) {
  try {
    const result = completeProductionBatch(Number(req.params.id), req.body);
    return res.json({
      success: true,
      message: "Production batch completed and inventory updated successfully.",
      production: result,
    });
  } catch (error) {
    console.error("Production completion error:", error);
    return res.status(400).json({
      success: false,
      message: error.message || "Unable to complete production batch.",
    });
  }
}

export function correctProduction(req, res) {
  try {
    const result = correctProductionBatch(Number(req.params.id), req.body);
    return res.json({
      success: true,
      message: "Production correction posted successfully.",
      production: result,
    });
  } catch (error) {
    console.error("Production correction error:", error);
    return res.status(400).json({
      success: false,
      message: error.message || "Unable to correct production batch.",
    });
  }
}

export function setProductionQc(req, res) {
  try {
    const result = updateProductionQc(Number(req.params.id), req.body);
    return res.json({
      success: true,
      message: "Production QC status updated.",
      batch: result,
    });
  } catch (error) {
    console.error("Production QC error:", error);
    return res.status(400).json({ success: false, message: error.message });
  }
}

export function closeProduction(req, res) {
  try {
    const result = closeProductionBatch(Number(req.params.id));
    return res.json({
      success: true,
      message: "Production batch closed successfully.",
      batch: result,
    });
  } catch (error) {
    console.error("Production close error:", error);
    return res.status(400).json({ success: false, message: error.message });
  }
}

export function listProductionBatches(req, res) {
  try {
    return res.json({ success: true, batches: getProductionBatches() });
  } catch (error) {
    console.error("Production register error:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to load production batches.",
    });
  }
}

export function listOpenProductionBatches(req, res) {
  try {
    return res.json({ success: true, batches: getOpenProductionBatches() });
  } catch (error) {
    console.error("Open production list error:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to load open production batches.",
    });
  }
}

export function productionBatchDetails(req, res) {
  try {
    const batch = getProductionBatchById(Number(req.params.id));

    if (!batch) {
      return res.status(404).json({
        success: false,
        message: "Production batch not found.",
      });
    }

    return res.json({ success: true, batch });
  } catch (error) {
    console.error("Production batch details error:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to load production batch details.",
    });
  }
}

export function cancelProduction(req, res) {
  try {
    const result = cancelProductionBatch(Number(req.params.id));

    return res.json({
      success: true,
      message: "Production batch cancelled successfully.",
      batch: result,
    });
  } catch (error) {
    console.error("Production cancellation error:", error);
    return res.status(400).json({
      success: false,
      message: error.message || "Unable to cancel production batch.",
    });
  }
}
