import express from "express";

import {
  calculateProduction,
  addProductionPlan,
  startProduction,
  completeProduction,
  correctProduction,
  setProductionQc,
  closeProduction,
  listProductionBatches,
  listOpenProductionBatches,
  productionBatchDetails,
  cancelProduction,
} from "../controllers/productionController.js";

const router = express.Router();

router.get("/calculate", calculateProduction);
router.get("/open", listOpenProductionBatches);
router.get("/", listProductionBatches);
router.post("/", addProductionPlan);

router.get("/:id", productionBatchDetails);
router.patch("/:id/start", startProduction);
router.patch("/:id/complete", completeProduction);
router.patch("/:id/correct", correctProduction);
router.patch("/:id/qc", setProductionQc);
router.patch("/:id/close", closeProduction);
router.patch("/:id/cancel", cancelProduction);

export default router;
