import express from "express";

import {
  addSale,
  listSales,
  salesDetails,
  receiveSalesPayment,
  cancelSalesInvoice,
  returnableSaleDetails,
  addSalesCreditNote,
  listSalesCreditNotes,
  salesCreditNoteDetails,
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

router.get(
  "/credit-notes",
  listSalesCreditNotes
);

router.get(
  "/credit-notes/:id",
  salesCreditNoteDetails
);

router.get(
  "/:id/returnable",
  returnableSaleDetails
);

router.post(
  "/:id/credit-note",
  addSalesCreditNote
);

export default router;