import {
  getCategories,
  createCategory,
  updateCategory,
  deactivateCategory,
  activateCategory,
} from "../services/categoryService.js";

export function listCategories(req, res) {
  try {
    const includeInactive =
      req.query.includeInactive === "true";

    const categories = getCategories(includeInactive);

    return res.json({
      success: true,
      categories,
    });
  } catch (error) {
    console.error("List categories error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to load categories",
    });
  }
}

export function addCategory(req, res) {
  try {
    const { code, name, inventoryRole } = req.body;

    if (!code?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Category code is required",
      });
    }

    if (!name?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Category name is required",
      });
    }

    if (!inventoryRole?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Inventory role is required",
      });
    }

    const category = createCategory(req.body);

    return res.status(201).json({
      success: true,
      message: "Category created successfully",
      category,
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message:
        error.message ||
        "Unable to create category",
    });
  }
}

export function editCategory(req, res) {
  try {
    const id = Number(req.params.id);

    const { code, name, inventoryRole } = req.body;

    if (!code?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Category code is required",
      });
    }

    if (!name?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Category name is required",
      });
    }

    if (!inventoryRole?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Inventory role is required",
      });
    }

    const category = updateCategory(id, req.body);

    return res.json({
      success: true,
      message: "Category updated successfully",
      category,
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message:
        error.message ||
        "Unable to update category",
    });
  }
}

export function removeCategory(req, res) {
  try {
    const id = Number(req.params.id);

    const category = deactivateCategory(id);

    return res.json({
      success: true,
      message: "Category deactivated successfully",
      category,
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message || "Unable to deactivate category",
    });
  }
}

export function restoreCategory(req, res) {
  try {
    const id = Number(req.params.id);

    const category = activateCategory(id);

    return res.json({
      success: true,
      message: "Category activated successfully",
      category,
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message || "Unable to activate category",
    });
  }
}