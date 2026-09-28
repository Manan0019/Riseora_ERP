import {
  getSuppliers,
  createSupplier,
  updateSupplier,
  deactivateSupplier,
  activateSupplier,
} from "../services/supplierService.js";

export function listSuppliers(req, res) {
  try {
    const suppliers = getSuppliers(req.query.includeInactive === "true");
    return res.json({ success: true, suppliers });
  } catch (error) {
    console.error("List suppliers error:", error);
    return res.status(500).json({ success: false, message: "Unable to load suppliers" });
  }
}

export function addSupplier(req, res) {
  try {
    const { name, paymentTermsDays } = req.body;
    if (!String(name || "").trim()) {
      return res.status(400).json({ success: false, message: "Supplier name is required" });
    }
    if (paymentTermsDays !== undefined && Number(paymentTermsDays) < 0) {
      return res.status(400).json({ success: false, message: "Payment terms cannot be negative" });
    }
    const supplier = createSupplier(req.body);
    return res.status(201).json({ success: true, message: "Supplier created successfully", supplier });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message || "Unable to create supplier" });
  }
}

export function editSupplier(req, res) {
  try {
    if (!String(req.body.name || "").trim()) {
      return res.status(400).json({ success: false, message: "Supplier name is required" });
    }
    const supplier = updateSupplier(Number(req.params.id), req.body);
    return res.json({ success: true, message: "Supplier updated successfully", supplier });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message || "Unable to update supplier" });
  }
}

export function removeSupplier(req, res) {
  try {
    const supplier = deactivateSupplier(Number(req.params.id));
    return res.json({ success: true, message: "Supplier deactivated successfully", supplier });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message || "Unable to deactivate supplier" });
  }
}

export function restoreSupplier(req, res) {
  try {
    const supplier = activateSupplier(Number(req.params.id));
    return res.json({ success: true, message: "Supplier activated successfully", supplier });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message || "Unable to activate supplier" });
  }
}
