import {
  calculateProductionRequirements,
  createProductionBatch,
  getProductionBatches,
  getProductionBatchById,
  cancelProductionBatch,
} from "../services/productionService.js";

export function calculateProduction(
  req,
  res
) {
  try {
    const {
      formulaId,
      batchSize,
    } = req.query;

    if (!formulaId) {
      return res.status(400).json({
        success: false,
        message:
          "Formula is required.",
      });
    }

    if (
      Number(batchSize) <= 0
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Batch size must be greater than zero.",
      });
    }

    const result =
      calculateProductionRequirements(
        Number(formulaId),
        Number(batchSize)
      );

    return res.json({
      success: true,
      calculation: result,
    });
  } catch (error) {
    console.error(
      "Production calculation error:",
      error
    );

    return res.status(400).json({
      success: false,
      message:
        error.message,
    });
  }
}

export function addProduction(
  req,
  res
) {
  try {
    const {
      productionDate,
      formulaId,
      plannedBatchSize,
      actualOutputQty,
    } = req.body;

    if (!productionDate) {
      return res.status(400).json({
        success: false,
        message:
          "Production date is required.",
      });
    }

    if (!formulaId) {
      return res.status(400).json({
        success: false,
        message:
          "Formula is required.",
      });
    }

    if (
      Number(
        plannedBatchSize
      ) <= 0
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Planned batch size must be greater than zero.",
      });
    }

    if (
      Number(
        actualOutputQty
      ) <= 0
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Actual output quantity must be greater than zero.",
      });
    }

    const production =
      createProductionBatch(
        req.body
      );

    return res.status(201).json({
      success: true,
      message:
        "Production batch saved successfully.",
      production,
    });
  } catch (error) {
    console.error(
      "Production save error:",
      error
    );

    return res.status(400).json({
      success: false,
      message:
        error.message ||
        "Unable to save production batch.",
    });
  }
}

export function listProductionBatches(req, res) {
  try {
    const batches =
      getProductionBatches();

    return res.json({
      success: true,
      batches,
    });
  } catch (error) {
    console.error(
      "Production register error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to load production batches.",
    });
  }
}

export function productionBatchDetails(req, res) {
  try {
    const batch =
      getProductionBatchById(
        Number(req.params.id)
      );

    if (!batch) {
      return res.status(404).json({
        success: false,
        message:
          "Production batch not found.",
      });
    }

    return res.json({
      success: true,
      batch,
    });
  } catch (error) {
    console.error(
      "Production batch details error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to load production batch details.",
    });
  }
}

export function cancelProduction(
  req,
  res
) {
  try {
    const result =
      cancelProductionBatch(
        Number(
          req.params.id
        )
      );

    return res.json({
      success: true,
      message:
        "Production batch cancelled and stock reversed successfully.",
      batch:
        result,
    });
  } catch (error) {
    console.error(
      "Production cancellation error:",
      error
    );

    return res.status(400).json({
      success: false,
      message:
        error.message ||
        "Unable to cancel production batch.",
    });
  }
}