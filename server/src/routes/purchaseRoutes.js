import express from "express";

import {
  addPurchase,
  listPurchases,
  getPurchaseDetails,
} from "../controllers/purchaseController.js";

const router =
  express.Router();

router.get("/", listPurchases);

router.get(
  "/:id",
  getPurchaseDetails
);

router.post("/", addPurchase);

export default router;