import {
  getUpadEntries,
  getUpadSummary,
  createUpad,
  updateUpad,
  deactivateUpad,
  activateUpad,
} from "../services/upadService.js";

export function listUpad(req, res) {
  try {
    return res.json({
      success: true,
      entries: getUpadEntries(req.query.includeInactive === "true"),
      summary: getUpadSummary(),
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message || "Unable to load Upad entries" });
  }
}

export function addUpad(req, res) {
  try {
    const entry = createUpad(req.body);
    return res.status(201).json({ success: true, message: "Upad entry saved successfully", entry });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message || "Unable to save Upad entry" });
  }
}

export function editUpad(req, res) {
  try {
    const entry = updateUpad(Number(req.params.id), req.body);
    return res.json({ success: true, message: "Upad entry updated successfully", entry });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message || "Unable to update Upad entry" });
  }
}

export function removeUpad(req, res) {
  try {
    const entry = deactivateUpad(Number(req.params.id));
    return res.json({ success: true, message: "Upad entry deactivated", entry });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message || "Unable to deactivate Upad entry" });
  }
}

export function restoreUpad(req, res) {
  try {
    const entry = activateUpad(Number(req.params.id));
    return res.json({ success: true, message: "Upad entry activated", entry });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message || "Unable to activate Upad entry" });
  }
}
