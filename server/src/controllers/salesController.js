import {
  createSale,
  getSalesInvoices,
  getSalesInvoiceById,
  addSalesPayment,
  cancelSale,
} from "../services/salesService.js";

import {
  getReturnableSale,
  createSalesCreditNote,
  getSalesCreditNotes,
  getSalesCreditNoteById,
} from "../services/salesCreditNoteService.js";

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

export function listSales(
  req,
  res
) {
  try {
    return res.json({
      success: true,
      invoices:
        getSalesInvoices(),
    });
  } catch (error) {
    console.error(
      "Sales register error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to load sales register.",
    });
  }
}

export function salesDetails(
  req,
  res
) {
  try {
    const invoice =
      getSalesInvoiceById(
        Number(req.params.id)
      );

    if (!invoice) {
      return res.status(404).json({
        success: false,
        message:
          "Sales invoice not found.",
      });
    }

    return res.json({
      success: true,
      invoice,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message:
        "Unable to load sales invoice.",
    });
  }
}

export function receiveSalesPayment(
  req,
  res
) {
  try {
    const {
      paymentDate,
      amount,
    } = req.body;

    if (!paymentDate) {
      return res.status(400).json({
        success: false,
        message:
          "Payment date is required.",
      });
    }

    if (
      Number(amount) <= 0
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Payment amount must be greater than zero.",
      });
    }

    const result =
      addSalesPayment(
        Number(req.params.id),
        req.body
      );

    return res.json({
      success: true,
      message:
        "Payment recorded successfully.",
      payment:
        result,
    });
  } catch (error) {
    console.error(
      "Sales payment error:",
      error
    );

    return res.status(400).json({
      success: false,
      message:
        error.message ||
        "Unable to record payment.",
    });
  }
}

export function cancelSalesInvoice(
  req,
  res
) {
  try {
    const result =
      cancelSale(
        Number(req.params.id)
      );

    return res.json({
      success: true,
      message:
        "Sales invoice cancelled and stock restored successfully.",
      invoice:
        result,
    });
  } catch (error) {
    console.error(
      "Sales cancellation error:",
      error
    );

    return res.status(400).json({
      success: false,
      message:
        error.message ||
        "Unable to cancel sales invoice.",
    });
  }
}

export function returnableSaleDetails(
  req,
  res
) {
  try {
    const invoice =
      getReturnableSale(
        Number(req.params.id)
      );

    return res.json({
      success: true,
      invoice,
    });
  } catch (error) {
    console.error(
      "Sales return preview error:",
      error
    );

    return res
      .status(400)
      .json({
        success: false,

        message:
          error.message ||
          "Unable to load returnable sale.",
      });
  }
}

export function addSalesCreditNote(
  req,
  res
) {
  try {
    const result =
      createSalesCreditNote({
        ...req.body,

        salesInvoiceId:
          Number(
            req.params.id
          ),
      });

    return res
      .status(201)
      .json({
        success: true,

        message:
          `${result.creditNoteNo} created successfully.`,

        creditNote:
          result,
      });
  } catch (error) {
    console.error(
      "Sales credit note error:",
      error
    );

    return res
      .status(400)
      .json({
        success: false,

        message:
          error.message ||
          "Unable to create sales credit note.",
      });
  }
}

export function listSalesCreditNotes(
  req,
  res
) {
  try {
    return res.json({
      success: true,

      creditNotes:
        getSalesCreditNotes(),
    });
  } catch (error) {
    console.error(error);

    return res
      .status(500)
      .json({
        success: false,

        message:
          "Unable to load sales credit notes.",
      });
  }
}

export function salesCreditNoteDetails(
  req,
  res
) {
  try {
    const creditNote =
      getSalesCreditNoteById(
        Number(req.params.id)
      );

    if (!creditNote) {
      return res
        .status(404)
        .json({
          success: false,

          message:
            "Sales credit note not found.",
        });
    }

    return res.json({
      success: true,
      creditNote,
    });
  } catch (error) {
    console.error(error);

    return res
      .status(500)
      .json({
        success: false,

        message:
          "Unable to load sales credit note.",
      });
  }
}