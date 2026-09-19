import express from "express";

import {
  listCustomerOutstanding,
  customerLedgerDetails,
} from "../controllers/customerLedgerController.js";

const router =
  express.Router();

router.get(
  "/",
  listCustomerOutstanding
);

router.get(
  "/:id",
  customerLedgerDetails
);

export default router;