import {
  createSale,
} from "../services/salesService.js";

export function addSale(
  req,
  res
) {
  try {
    const {
      invoiceDate,
      customerId,
      items,
    } = req.body;

    if (!invoiceDate) {
      return res.status(400).json({
        success: false,
        message:
          "Invoice date is required.",
      });
    }

    if (!customerId) {
      return res.status(400).json({
        success: false,
        message:
          "Customer is required.",
      });
    }

    if (
      !Array.isArray(items) ||
      items.length === 0
    ) {
      return res.status(400).json({
        success: false,
        message:
          "At least one sale item is required.",
      });
    }

    for (
      let index = 0;
      index < items.length;
      index++
    ) {
      const item =
        items[index];

      if (!item.itemId) {
        return res.status(400).json({
          success: false,
          message:
            `Item is required in row ${index + 1}.`,
        });
      }

      if (
        Number(
          item.quantity
        ) <= 0
      ) {
        return res.status(400).json({
          success: false,
          message:
            `Quantity must be greater than zero in row ${index + 1}.`,
        });
      }

      if (
        Number(item.rate) < 0
      ) {
        return res.status(400).json({
          success: false,
          message:
            `Rate cannot be negative in row ${index + 1}.`,
        });
      }
    }

    const sale =
      createSale(
        req.body
      );

    return res.status(201).json({
      success: true,
      message:
        "Sales invoice saved successfully.",
      sale,
    });
  } catch (error) {
    console.error(
      "Sales invoice error:",
      error
    );

    return res.status(400).json({
      success: false,
      message:
        error.message ||
        "Unable to save sales invoice.",
    });
  }
}