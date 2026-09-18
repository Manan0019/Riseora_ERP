import {
  createOpeningStock,
} from "../services/openingStockService.js";

export function addOpeningStock(req, res) {
  try {
    const {
      openingDate,
      items,
    } = req.body;

    if (!openingDate) {
      return res.status(400).json({
        success: false,
        message:
          "Opening stock date is required.",
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

      if (
        Number(item.unitCost || 0) < 0
      ) {
        return res.status(400).json({
          success: false,
          message:
            `Unit cost cannot be negative in row ${index + 1}.`,
        });
      }
    }

    const openingStock =
      createOpeningStock(req.body);

    return res.status(201).json({
      success: true,
      message:
        "Opening stock saved successfully.",
      openingStock,
    });
  } catch (error) {
    console.error(
      "Opening stock error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        error.message ||
        "Unable to save opening stock.",
    });
  }
}