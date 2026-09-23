import {
  addCustomerOpeningSettlement,
  addSupplierOpeningSettlement,
  getOpeningBalanceSetup,
  saveCustomerOpeningBalance,
  saveSupplierOpeningBalance,
} from "../services/openingBalanceService.js";

export function openingBalanceSetup(req, res) {
  try {
    return res.json({ success: true, ...getOpeningBalanceSetup() });
  } catch (error) {
    console.error("Opening balance setup error:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to load opening balances.",
    });
  }
}

export function saveCustomerOpening(req, res) {
  try {
    const openingBalance = saveCustomerOpeningBalance(Number(req.params.id), req.body);
    return res.json({
      success: true,
      message: "Customer opening balance saved successfully.",
      openingBalance,
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message || "Unable to save customer opening balance.",
    });
  }
}

export function saveSupplierOpening(req, res) {
  try {
    const openingBalance = saveSupplierOpeningBalance(Number(req.params.id), req.body);
    return res.json({
      success: true,
      message: "Supplier opening balance saved successfully.",
      openingBalance,
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message || "Unable to save supplier opening balance.",
    });
  }
}

export function settleCustomerOpening(req, res) {
  try {
    const result = addCustomerOpeningSettlement(Number(req.params.id), req.body);
    return res.status(201).json({
      success: true,
      message: "Customer opening balance settlement recorded successfully.",
      settlement: result,
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message || "Unable to record customer opening settlement.",
    });
  }
}

export function settleSupplierOpening(req, res) {
  try {
    const result = addSupplierOpeningSettlement(Number(req.params.id), req.body);
    return res.status(201).json({
      success: true,
      message: "Supplier opening balance settlement recorded successfully.",
      settlement: result,
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message || "Unable to record supplier opening settlement.",
    });
  }
}
