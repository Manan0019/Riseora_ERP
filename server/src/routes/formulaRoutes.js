import express from "express";

import {
  listFormulas,
  formulaDetails,
  addFormula,
  editFormula,
  addFormulaVersion,
  removeFormula,
  restoreFormula,
} from "../controllers/formulaController.js";

const router =
  express.Router();

router.get(
  "/",
  listFormulas
);

router.get(
  "/:id",
  formulaDetails
);

router.post(
  "/",
  addFormula
);

router.post(
  "/:id/new-version",
  addFormulaVersion
);

router.put(
  "/:id",
  editFormula
);

router.patch(
  "/:id/deactivate",
  removeFormula
);

router.patch(
  "/:id/activate",
  restoreFormula
);

export default router;