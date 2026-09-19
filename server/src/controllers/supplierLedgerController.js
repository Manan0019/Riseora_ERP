import {
  getSupplierOutstanding,
  getSupplierLedger,
  addSupplierPayment,
} from "../services/supplierLedgerService.js";

export function listSupplierOutstanding(
  req,
  res
) {
  try {
    return res.json({
      success: true,
      suppliers:
        getSupplierOutstanding(),
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message:
        "Unable to load supplier outstanding.",
    });
  }
}

export function supplierLedgerDetails(
  req,
  res
) {
  try {
    const result =
      getSupplierLedger(
        Number(req.params.id)
      );

    if (!result) {
      return res.status(404).json({
        success: false,
        message:
          "Supplier not found.",
      });
    }

    return res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message:
        "Unable to load supplier ledger.",
    });
  }
}

export function recordSupplierPayment(
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
      addSupplierPayment(
        Number(
          req.params.purchaseId
        ),
        req.body
      );

    return res.json({
      success: true,
      message:
        "Supplier payment recorded successfully.",
      payment: result,
    });
  } catch (error) {
    console.error(error);

    return res.status(400).json({
      success: false,
      message:
        error.message ||
        "Unable to record supplier payment.",
    });
  }
}