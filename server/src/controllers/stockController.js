import {
  getCurrentStock,
  getItemStock,
} from "../services/stockService.js";

import {
  getStockLedger,
} from "../services/stockLedgerService.js";

import {
  previewItemCostRebuild,
  rebuildItemCostState,
} from "../services/costService.js";

export function listCurrentStock(
  req,
  res
) {
  try {
    const stock =
      getCurrentStock();

    return res.json({
      success: true,
      stock,
    });
  } catch (error) {
    console.error(
      "Stock error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to load stock",
    });
  }
}

export function getStockForItem(
  req,
  res
) {
  try {
    const itemId =
      Number(req.params.id);

    const stock =
      getItemStock(itemId);

    return res.json({
      success: true,
      itemId,
      currentStock: stock,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message:
        "Unable to load item stock",
    });
  }
}

export function getLedgerForItem(req, res) {
  try {
    const itemId =
      Number(req.params.id);

    const ledger =
      getStockLedger(itemId);

    return res.json({
      success: true,
      ledger,
    });
  } catch (error) {
    console.error(
      "Stock ledger error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to load stock ledger",
    });
  }
}

export function costingPreview(
  req,
  res
) {
  try {
    const preview =
      previewItemCostRebuild(
        Number(
          req.params.id
        )
      );

    return res.json({
      success: true,
      preview,
    });
  } catch (error) {
    console.error(error);

    return res
      .status(400)
      .json({
        success: false,

        message:
          error.message ||
          "Unable to preview inventory costing.",
      });
  }
}

export function rebuildCosting(
  req,
  res
) {
  try {
    const result =
      rebuildItemCostState(
        Number(
          req.params.id
        )
      );

    return res.json({
      success: true,

      message:
        "Inventory costing rebuilt successfully.",

      result,
    });
  } catch (error) {
    console.error(error);

    return res
      .status(400)
      .json({
        success: false,

        message:
          error.message ||
          "Unable to rebuild inventory costing.",
      });
  }
}