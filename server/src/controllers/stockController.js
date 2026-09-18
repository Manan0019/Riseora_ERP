import {
  getCurrentStock,
  getItemStock,
} from "../services/stockService.js";

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