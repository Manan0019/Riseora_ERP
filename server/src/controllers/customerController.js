import {
  getCustomers,
  createCustomer,
  updateCustomer,
  deactivateCustomer,
  activateCustomer,
} from "../services/customerService.js";

export function listCustomers(req, res) {
  try {
    const includeInactive =
      req.query.includeInactive === "true";

    const customers =
      getCustomers(includeInactive);

    return res.json({
      success: true,
      customers,
    });
  } catch (error) {
    console.error("List customers error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to load customers",
    });
  }
}

export function addCustomer(req, res) {
  try {
    const {
      code,
      name,
      creditDays,
      creditLimit,
    } = req.body;

    if (!code?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Customer code is required",
      });
    }

    if (!name?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Customer name is required",
      });
    }

    if (
      creditDays !== undefined &&
      Number(creditDays) < 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Credit days cannot be negative",
      });
    }

    if (
      creditLimit !== undefined &&
      Number(creditLimit) < 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Credit limit cannot be negative",
      });
    }

    const customer =
      createCustomer(req.body);

    return res.status(201).json({
      success: true,
      message: "Customer created successfully",
      customer,
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message:
        error.message ||
        "Unable to create customer",
    });
  }
}

export function editCustomer(req, res) {
  try {
    const id = Number(req.params.id);

    const { code, name } = req.body;

    if (!code?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Customer code is required",
      });
    }

    if (!name?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Customer name is required",
      });
    }

    const customer =
      updateCustomer(id, req.body);

    return res.json({
      success: true,
      message: "Customer updated successfully",
      customer,
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message:
        error.message ||
        "Unable to update customer",
    });
  }
}

export function removeCustomer(req, res) {
  try {
    const id = Number(req.params.id);

    const customer =
      deactivateCustomer(id);

    return res.json({
      success: true,
      message: "Customer deactivated successfully",
      customer,
    });
  } catch (error) {
    console.error(
      "Deactivate customer error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to deactivate customer",
    });
  }
}

export function restoreCustomer(req, res) {
  try {
    const id = Number(req.params.id);

    const customer =
      activateCustomer(id);

    return res.json({
      success: true,
      message: "Customer activated successfully",
      customer,
    });
  } catch (error) {
    console.error(
      "Activate customer error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to activate customer",
    });
  }
}