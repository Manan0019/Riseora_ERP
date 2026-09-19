import express from "express";

import {
  addSale,
  listSales,
  salesDetails,
  receiveSalesPayment,
  cancelSalesInvoice,
} from "../controllers/salesController.js";

const router =
  express.Router();

router.post(
  "/",
  addSale
);

router.get(
  "/",
  listSales
);

router.get(
  "/:id",
  salesDetails
);

router.post(
  "/:id/payments",
  receiveSalesPayment
);

router.patch(
  "/:id/cancel",
  cancelSalesInvoice
);

export default router;