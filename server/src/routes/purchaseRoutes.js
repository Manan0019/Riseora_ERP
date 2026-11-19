import express from "express";

import {
  addPurchase,
  editPurchase,
  listPurchases,
  getPurchaseDetails,
  cancelPurchaseEntry,
} from "../controllers/purchaseController.js";

const router = express.Router();

router.post("/", addPurchase);

router.get("/", listPurchases);

router.get("/:id", getPurchaseDetails);
router.put("/:id", editPurchase);

router.patch("/:id/cancel", cancelPurchaseEntry);

export default router;
