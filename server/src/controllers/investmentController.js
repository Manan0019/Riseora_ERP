import {
  getInvestments,
  getInvestmentSummary,
  getInvestmentDetails,
  createInvestment,
  updateInvestment,
  addInvestmentPayment,
  deactivateInvestment,
  activateInvestment,
} from "../services/investmentService.js";

export function listInvestments(req, res) {
  try {
    return res.json({
      success: true,
      investments: getInvestments(req.query.includeInactive === "true"),
      summary: getInvestmentSummary(),
    });
  } catch (error) {
    console.error("List investments error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Unable to load investments",
    });
  }
}

export function investmentDetails(req, res) {
  try {
    const result = getInvestmentDetails(Number(req.params.id));
    if (!result) {
      return res.status(404).json({ success: false, message: "Investment entry not found." });
    }
    return res.json({ success: true, ...result });
  } catch (error) {
    console.error("Investment details error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Unable to load investment details",
    });
  }
}

export function addInvestment(req, res) {
  try {
    const investment = createInvestment(req.body);
    return res.status(201).json({
      success: true,
      message: "Investment / borrowing saved successfully",
      investment,
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message || "Unable to save investment",
    });
  }
}

export function editInvestment(req, res) {
  try {
    const investment = updateInvestment(Number(req.params.id), req.body);
    return res.json({
      success: true,
      message: "Investment / borrowing updated successfully",
      investment,
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message || "Unable to update investment",
    });
  }
}

export function recordInvestmentPayment(req, res) {
  try {
    const result = addInvestmentPayment(Number(req.params.id), req.body);
    return res.status(201).json({
      success: true,
      message: "Investment payment / return recorded successfully",
      ...result,
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message || "Unable to record investment payment",
    });
  }
}

export function removeInvestment(req, res) {
  try {
    const investment = deactivateInvestment(Number(req.params.id));
    return res.json({ success: true, message: "Investment entry deactivated", investment });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message || "Unable to deactivate investment" });
  }
}

export function restoreInvestment(req, res) {
  try {
    const investment = activateInvestment(Number(req.params.id));
    return res.json({ success: true, message: "Investment entry activated", investment });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message || "Unable to activate investment" });
  }
}
