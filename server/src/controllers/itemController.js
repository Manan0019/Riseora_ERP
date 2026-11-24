import {
  getItems,
  bulkEditItems,
  getNextItemCode,
  createItem,
  updateItem,
  deactivateItem,
  activateItem,
} from "../services/itemService.js";

export function listItems(req, res) {
  try {
    const includeInactive =
      req.query.includeInactive === "true";

    const items =
      getItems(includeInactive);

    return res.json({
      success: true,
      items,
    });
  } catch (error) {
    console.error(
      "List items error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to load items",
    });
  }
}

export function previewItemCode(req, res) {
  try {
    return res.json({ success: true, code: getNextItemCode(req.query.categoryId) });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
}

export function addItem(req, res) {
  try {
    const {
      name,
      categoryId,
      baseUnitId,
    } = req.body;

    if (!name?.trim()) {
      return res.status(400).json({
        success: false,
        message:
          "Item name is required",
      });
    }

    if (!categoryId) {
      return res.status(400).json({
        success: false,
        message:
          "Category is required",
      });
    }

    if (!baseUnitId) {
      return res.status(400).json({
        success: false,
        message:
          "Base unit is required",
      });
    }

    const item =
      createItem(req.body);

    return res.status(201).json({
      success: true,
      message:
        "Item created successfully",
      item,
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message:
        error.message ||
        "Unable to create item",
    });
  }
}

export function editItem(req, res) {
  try {
    const id =
      Number(req.params.id);

    const item =
      updateItem(
        id,
        req.body
      );

    return res.json({
      success: true,
      message:
        "Item updated successfully",
      item,
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message:
        error.message ||
        "Unable to update item",
    });
  }
}

export function removeItem(req, res) {
  try {
    const item =
      deactivateItem(
        Number(req.params.id)
      );

    return res.json({
      success: true,
      message:
        "Item deactivated successfully",
      item,
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message:
        error.message ||
        "Unable to deactivate item",
    });
  }
}

export function restoreItem(req, res) {
  try {
    const item =
      activateItem(
        Number(req.params.id)
      );

    return res.json({
      success: true,
      message:
        "Item activated successfully",
      item,
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message:
        error.message ||
        "Unable to activate item",
    });
  }
}
export function editItemsBulk(req,res){
  try {const updated=bulkEditItems(req.body);return res.json({success:true,updated});}
  catch(error){return res.status(400).json({success:false,message:error.message});}
}
