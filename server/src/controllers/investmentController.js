import {
  getInvestments,
  getInvestmentSummary,
  createInvestment,
  updateInvestment,
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
    return res.status(500).json({ success: false, message: error.message || "Unable to load investments" });
  }
}

export function addInvestment(req, res) {
  try {
    const investment = createInvestment(req.body);
    return res.status(201).json({ success: true, message: "Investment saved successfully", investment });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message || "Unable to save investment" });
  }
}

export function editInvestment(req, res) {
  try {
    const investment = updateInvestment(Number(req.params.id), req.body);
    return res.json({ success: true, message: "Investment updated successfully", investment });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message || "Unable to update investment" });
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
