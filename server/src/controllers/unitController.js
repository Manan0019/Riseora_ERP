import {
  getUnits,
  createUnit,
  updateUnit,
  deactivateUnit,
  activateUnit,
} from "../services/unitService.js";

export function listUnits(req, res) {
  try {
    const includeInactive =
      req.query.includeInactive === "true";

    const units = getUnits(includeInactive);

    return res.json({
      success: true,
      units,
    });
  } catch (error) {
    console.error("List units error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to load units",
    });
  }
}

export function addUnit(req, res) {
  try {
    const { code, name, unitType } = req.body;

    if (!code?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Unit code is required",
      });
    }

    if (!name?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Unit name is required",
      });
    }

    if (!unitType?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Unit type is required",
      });
    }

    const unit = createUnit(req.body);

    return res.status(201).json({
      success: true,
      message: "Unit created successfully",
      unit,
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message || "Unable to create unit",
    });
  }
}

export function editUnit(req, res) {
  try {
    const id = Number(req.params.id);

    const unit = updateUnit(id, req.body);

    return res.json({
      success: true,
      message: "Unit updated successfully",
      unit,
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message || "Unable to update unit",
    });
  }
}

export function removeUnit(req, res) {
  try {
    const id = Number(req.params.id);

    const unit = deactivateUnit(id);

    return res.json({
      success: true,
      message: "Unit deactivated successfully",
      unit,
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message || "Unable to deactivate unit",
    });
  }
}

export function restoreUnit(req, res) {
  try {
    const id = Number(req.params.id);

    const unit = activateUnit(id);

    return res.json({
      success: true,
      message: "Unit activated successfully",
      unit,
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message || "Unable to activate unit",
    });
  }
}