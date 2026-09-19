import express from "express";

import {
  calculateProduction,
  addProduction,
  listProductionBatches,
  productionBatchDetails,
  cancelProduction,
} from "../controllers/productionController.js";

const router =
  express.Router();

router.get(
  "/calculate",
  calculateProduction
);

router.get(
  "/",
  listProductionBatches
);

router.get(
  "/:id",
  productionBatchDetails
);

router.post(
  "/",
  addProduction
);

router.patch(
  "/:id/cancel",
  cancelProduction
);

export default router;