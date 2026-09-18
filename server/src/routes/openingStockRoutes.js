import express from "express";

import {
  addOpeningStock,
} from "../controllers/openingStockController.js";

const router =
  express.Router();

router.post(
  "/",
  addOpeningStock
);

export default router;