import express from "express";

import {
  listCurrentStock,
  getStockForItem,
  getLedgerForItem,
  costingPreview,
  rebuildCosting,
} from "../controllers/stockController.js";

const router = express.Router();

router.get("/", listCurrentStock);

router.get("/item/:id", getStockForItem);

router.get("/item/:id/ledger", getLedgerForItem);

router.get("/item/:id/costing-preview", costingPreview);

router.post("/item/:id/rebuild-costing", rebuildCosting);

export default router;
