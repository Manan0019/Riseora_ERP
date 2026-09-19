import express from "express";

import {
  listSupplierOutstanding,
  supplierLedgerDetails,
  recordSupplierPayment,
} from "../controllers/supplierLedgerController.js";

const router =
  express.Router();

router.get(
  "/",
  listSupplierOutstanding
);

router.get(
  "/:id",
  supplierLedgerDetails
);

router.post(
  "/purchase/:purchaseId/payments",
  recordSupplierPayment
);

export default router;