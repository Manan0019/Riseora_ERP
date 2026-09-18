import express from "express";

import {
  listCurrentStock,
  getStockForItem,
  getLedgerForItem,
} from "../controllers/stockController.js";

const router = express.Router();

router.get("/", listCurrentStock);

router.get("/item/:id", getStockForItem);

router.get("/item/:id/ledger", getLedgerForItem);

export default router;
