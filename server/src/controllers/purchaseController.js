import { createPurchase } from "../services/purchaseService.js";

export function addPurchase(req, res) {
  try {
    const {
      purchaseDate,
      supplierId,
      items,
    } = req.body;

    if (!purchaseDate) {
      return res.status(400).json({
        success: false,
        message:
          "Purchase date is required",
      });
    }

    if (!supplierId) {
      return res.status(400).json({
        success: false,
        message:
          "Supplier is required",
      });
    }

    if (
      !Array.isArray(items) ||
      items.length === 0
    ) {
      return res.status(400).json({
        success: false,
        message:
          "At least one purchase item is required",
      });
    }

    for (const item of items) {
      if (!item.itemId) {
        return res.status(400).json({
          success: false,
          message:
            "Item is required",
        });
      }

      if (
        Number(item.quantity) <= 0
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Quantity must be greater than zero",
        });
      }

      if (
        Number(item.rate) < 0
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Rate cannot be negative",
        });
      }
    }

    const purchase =
      createPurchase(req.body);

    return res.status(201).json({
      success: true,
      message:
        "Purchase saved successfully",
      purchase,
    });
  } catch (error) {
    console.error(
      "Create purchase error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        error.message ||
        "Unable to save purchase",
    });
  }
}