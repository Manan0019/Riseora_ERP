import {
  createStockAdjustment,
} from "../services/stockAdjustmentService.js";

export function addStockAdjustment(
  req,
  res
) {
  try {
    const {
      adjustmentDate,
      adjustmentType,
      reason,
      items,
    } = req.body;

    if (!adjustmentDate) {
      return res.status(400).json({
        success: false,
        message:
          "Adjustment date is required.",
      });
    }

    if (
      !["IN", "OUT"].includes(
        adjustmentType
      )
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Adjustment type must be IN or OUT.",
      });
    }

    if (!reason?.trim()) {
      return res.status(400).json({
        success: false,
        message:
          "Reason is required.",
      });
    }

    if (
      !Array.isArray(items) ||
      items.length === 0
    ) {
      return res.status(400).json({
        success: false,
        message:
          "At least one item is required.",
      });
    }

    for (
      let index = 0;
      index < items.length;
      index++
    ) {
      const item = items[index];

      if (!item.itemId) {
        return res.status(400).json({
          success: false,
          message:
            `Item is required in row ${index + 1}.`,
        });
      }

      if (
        Number(item.quantity) <= 0
      ) {
        return res.status(400).json({
          success: false,
          message:
            `Quantity must be greater than zero in row ${index + 1}.`,
        });
      }
    }

    const adjustment =
      createStockAdjustment(
        req.body
      );

    return res.status(201).json({
      success: true,
      message:
        "Stock adjustment saved successfully.",
      adjustment,
    });
  } catch (error) {
    console.error(
      "Stock adjustment error:",
      error
    );

    return res.status(400).json({
      success: false,
      message:
        error.message ||
        "Unable to save stock adjustment.",
    });
  }
}