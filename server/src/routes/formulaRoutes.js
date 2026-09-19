import express from "express";

import {
  listFormulas,
  formulaDetails,
  addFormula,
  editFormula,
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