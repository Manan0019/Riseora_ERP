import {
  calculateProductionRequirements,
  createProductionBatch,
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