import {
  getCustomerOutstanding,
  getCustomerLedger,
} from "../services/customerLedgerService.js";

export function listCustomerOutstanding(
  req,
  res
) {
  try {
    return res.json({
      success: true,
      customers:
        getCustomerOutstanding(),
    });
  } catch (error) {
    console.error(
      "Customer outstanding error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to load customer outstanding.",
    });
  }
}

export function customerLedgerDetails(
  req,
  res
) {
  try {
    const result =
      getCustomerLedger(
        Number(req.params.id)
      );

    if (!result) {
      return res.status(404).json({
        success: false,
        message:
          "Customer not found.",
      });
    }

    return res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error(
      "Customer ledger error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to load customer ledger.",
    });
  }
}