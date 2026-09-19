import {
  getFormulas,
  getFormulaById,
  createFormula,
  updateFormula,
  deactivateFormula,
  activateFormula,
} from "../services/formulaService.js";

function validateFormula(data) {
  if (!data.code?.trim()) {
    return "Formula code is required.";
  }

  if (!data.name?.trim()) {
    return "Formula name is required.";
  }

  if (!data.finishedItemId) {
    return "Finished product is required.";
  }

  if (
    Number(data.batchSize) <= 0
  ) {
    return "Batch size must be greater than zero.";
  }

  if (!data.batchUnitId) {
    return "Batch unit is required.";
  }

  if (
    !Array.isArray(
      data.ingredients
    ) ||
    data.ingredients.length === 0
  ) {
    return "At least one ingredient is required.";
  }

  for (
    let index = 0;
    index < data.ingredients.length;
    index++
  ) {
    const ingredient =
      data.ingredients[index];

    if (
      !ingredient.ingredientItemId
    ) {
      return `Ingredient is required in row ${
        index + 1
      }.`;
    }

    if (
      Number(
        ingredient.quantity
      ) <= 0
    ) {
      return `Ingredient quantity must be greater than zero in row ${
        index + 1
      }.`;
    }

    if (!ingredient.unitId) {
      return `Ingredient unit is required in row ${
        index + 1
      }.`;
    }

    if (
      ingredient.percentage !== "" &&
      ingredient.percentage != null &&
      (
        Number(
          ingredient.percentage
        ) < 0 ||
        Number(
          ingredient.percentage
        ) > 100
      )
    ) {
      return `Percentage must be between 0 and 100 in row ${
        index + 1
      }.`;
    }
  }

  return null;
}

export function listFormulas(
  req,
  res
) {
  try {
    const includeInactive =
      req.query.includeInactive ===
      "true";

    return res.json({
      success: true,
      formulas:
        getFormulas(
          includeInactive
        ),
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message:
        "Unable to load formulas.",
    });
  }
}

export function formulaDetails(
  req,
  res
) {
  try {
    const formula =
      getFormulaById(
        Number(req.params.id)
      );

    if (!formula) {
      return res.status(404).json({
        success: false,
        message:
          "Formula not found.",
      });
    }

    return res.json({
      success: true,
      formula,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message:
        "Unable to load formula.",
    });
  }
}

export function addFormula(
  req,
  res
) {
  try {
    const validationError =
      validateFormula(req.body);

    if (validationError) {
      return res.status(400).json({
        success: false,
        message:
          validationError,
      });
    }

    const formula =
      createFormula(req.body);

    return res.status(201).json({
      success: true,
      message:
        "Formula saved successfully.",
      formula,
    });
  } catch (error) {
    console.error(error);

    return res.status(400).json({
      success: false,
      message:
        error.message ||
        "Unable to save formula.",
    });
  }
}

export function editFormula(
  req,
  res
) {
  try {
    const validationError =
      validateFormula(req.body);

    if (validationError) {
      return res.status(400).json({
        success: false,
        message:
          validationError,
      });
    }

    const formula =
      updateFormula(
        Number(req.params.id),
        req.body
      );

    return res.json({
      success: true,
      message:
        "Formula updated successfully.",
      formula,
    });
  } catch (error) {
    console.error(error);

    return res.status(400).json({
      success: false,
      message:
        error.message ||
        "Unable to update formula.",
    });
  }
}

export function removeFormula(
  req,
  res
) {
  try {
    deactivateFormula(
      Number(req.params.id)
    );

    return res.json({
      success: true,
      message:
        "Formula deactivated successfully.",
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message:
        error.message,
    });
  }
}

export function restoreFormula(
  req,
  res
) {
  try {
    activateFormula(
      Number(req.params.id)
    );

    return res.json({
      success: true,
      message:
        "Formula activated successfully.",
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message:
        error.message,
    });
  }
}