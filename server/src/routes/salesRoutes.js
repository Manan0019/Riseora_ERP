import express from "express";

import {
  addSale,
  listSales,
  salesDetails,
  receiveSalesPayment,
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

export default router;