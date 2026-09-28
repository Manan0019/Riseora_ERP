import express from "express";
import {
  listInvestments,
  investmentDetails,
  addInvestment,
  editInvestment,
  recordInvestmentPayment,
  removeInvestment,
  restoreInvestment,
} from "../controllers/investmentController.js";

const router = express.Router();

router.get("/", listInvestments);
router.post("/", addInvestment);
router.get("/:id", investmentDetails);
router.put("/:id", editInvestment);
router.post("/:id/payments", recordInvestmentPayment);
router.patch("/:id/deactivate", removeInvestment);
router.patch("/:id/activate", restoreInvestment);

export default router;
