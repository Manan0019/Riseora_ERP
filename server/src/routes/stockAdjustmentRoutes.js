import express from "express";

import {
  addStockAdjustment,
} from "../controllers/stockAdjustmentController.js";

const router =
  express.Router();

router.post(
  "/",
  addStockAdjustment
);

export default router;