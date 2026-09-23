import express from "express";

import {
  openingBalanceSetup,
  saveCustomerOpening,
  saveSupplierOpening,
  settleCustomerOpening,
  settleSupplierOpening,
} from "../controllers/openingBalanceController.js";

const router = express.Router();

router.get("/", openingBalanceSetup);
router.put("/customers/:id", saveCustomerOpening);
router.post("/customers/:id/settlements", settleCustomerOpening);
router.put("/suppliers/:id", saveSupplierOpening);
router.post("/suppliers/:id/settlements", settleSupplierOpening);

export default router;
