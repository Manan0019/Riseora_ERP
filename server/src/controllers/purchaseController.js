import {
  createPurchase,
  getPurchases,
  getPurchaseById,
  cancelPurchase,
} from "../services/purchaseService.js";

export function addPurchase(req, res) {
  try {
    const { purchaseDate, supplierId, items } = req.body;

    if (!purchaseDate) {
      return res.status(400).json({
        success: false,
        message: "Purchase date is required",
      });
    }

    if (!supplierId) {
      return res.status(400).json({
        success: false,
        message: "Supplier is required",
      });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: "At least one purchase item is required",
      });
    }

    for (const item of items) {
      if (!item.itemId) {
        return res.status(400).json({
          success: false,
          message: "Item is required",
        });
      }

      if (Number(item.quantity) <= 0) {
        return res.status(400).json({
          success: false,
          message: "Quantity must be greater than zero",
        });
      }

      if (Number(item.rate) < 0) {
        return res.status(400).json({
          success: false,
          message: "Rate cannot be negative",
        });
      }
    }

    const purchase = createPurchase(req.body);

    return res.status(201).json({
      success: true,
      message: "Purchase saved successfully",
      purchase,
    });
  } catch (error) {
    console.error("Create purchase error:", error);

    return res.status(500).json({
      success: false,
      message: error.message || "Unable to save purchase",
    });
  }
}

export function listPurchases(req, res) {
  try {
    const purchases = getPurchases();

    return res.json({
      success: true,
      purchases,
    });
  } catch (error) {
    console.error(
      "List purchases error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to load purchases",
    });
  }
}

export function getPurchaseDetails(req, res) {
  try {
    const id = Number(req.params.id);

    const purchase =
      getPurchaseById(id);

    if (!purchase) {
      return res.status(404).json({
        success: false,
        message:
          "Purchase not found",
      });
    }

    return res.json({
      success: true,
      purchase,
    });
  } catch (error) {
    console.error(
      "Purchase details error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to load purchase details",
    });
  }
}

export function cancelPurchaseEntry(req, res) {
  try {
    const id = Number(req.params.id);

    const result =
      cancelPurchase(id);

    return res.json({
      success: true,
      message:
        "Purchase cancelled and stock reversed successfully",
      purchase: result,
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message:
        error.message ||
        "Unable to cancel purchase",
    });
  }
}