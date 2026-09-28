import {
  getCustomers,
  createCustomer,
  updateCustomer,
  deactivateCustomer,
  activateCustomer,
} from "../services/customerService.js";

export function listCustomers(req, res) {
  try {
    const customers = getCustomers(req.query.includeInactive === "true");
    return res.json({ success: true, customers });
  } catch (error) {
    console.error("List customers error:", error);
    return res.status(500).json({ success: false, message: "Unable to load customers" });
  }
}

export function addCustomer(req, res) {
  try {
    const { name, creditDays, creditLimit } = req.body;
    if (!String(name || "").trim()) {
      return res.status(400).json({ success: false, message: "Customer name is required" });
    }
    if (creditDays !== undefined && Number(creditDays) < 0) {
      return res.status(400).json({ success: false, message: "Credit days cannot be negative" });
    }
    if (creditLimit !== undefined && Number(creditLimit) < 0) {
      return res.status(400).json({ success: false, message: "Credit limit cannot be negative" });
    }
    const customer = createCustomer(req.body);
    return res.status(201).json({ success: true, message: "Customer created successfully", customer });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message || "Unable to create customer" });
  }
}

export function editCustomer(req, res) {
  try {
    if (!String(req.body.name || "").trim()) {
      return res.status(400).json({ success: false, message: "Customer name is required" });
    }
    const customer = updateCustomer(Number(req.params.id), req.body);
    return res.json({ success: true, message: "Customer updated successfully", customer });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message || "Unable to update customer" });
  }
}

export function removeCustomer(req, res) {
  try {
    const customer = deactivateCustomer(Number(req.params.id));
    return res.json({ success: true, message: "Customer deactivated successfully", customer });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message || "Unable to deactivate customer" });
  }
}

export function restoreCustomer(req, res) {
  try {
    const customer = activateCustomer(Number(req.params.id));
    return res.json({ success: true, message: "Customer activated successfully", customer });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message || "Unable to activate customer" });
  }
}
