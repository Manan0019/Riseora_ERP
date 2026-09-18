import express from "express";

import {
  listCurrentStock,
  getStockForItem,
} from "../controllers/stockController.js";

const router =
  express.Router();

router.get("/", listCurrentStock);

router.get(
  "/item/:id",
  getStockForItem
);

export default router;