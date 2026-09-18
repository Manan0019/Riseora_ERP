import express from "express";

import {
  addPurchase,
} from "../controllers/purchaseController.js";

const router =
  express.Router();

router.post("/", addPurchase);

export default router;