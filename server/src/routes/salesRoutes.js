import express from "express";

import {
  addSale,
  listSales,
  salesDetails,
  replaceSalesInvoice,
  receiveSalesPayment,
  recordSalesRefund,
  cancelSalesInvoice,
  returnableSaleDetails,
  addSalesCreditNote,
  listSalesCreditNotes,
  salesCreditNoteDetails,
} from "../controllers/salesController.js";

const router = express.Router();

router.get("/credit-notes", listSalesCreditNotes);
router.get("/credit-notes/:id", salesCreditNoteDetails);

router.get("/", listSales);
router.post("/", addSale);

router.put("/:id/replace", replaceSalesInvoice);
router.get("/:id/returnable", returnableSaleDetails);
router.post("/:id/credit-note", addSalesCreditNote);
router.post("/:id/payments", receiveSalesPayment);
router.post("/:id/refunds", recordSalesRefund);
router.patch("/:id/cancel", cancelSalesInvoice);
router.get("/:id", salesDetails);

export default router;
