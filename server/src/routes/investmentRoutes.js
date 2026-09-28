import express from "express";
import {
  listInvestments,
  addInvestment,
  editInvestment,
  removeInvestment,
  restoreInvestment,
} from "../controllers/investmentController.js";

const router = express.Router();
router.get("/", listInvestments);
router.post("/", addInvestment);
router.put("/:id", editInvestment);
router.patch("/:id/deactivate", removeInvestment);
router.patch("/:id/activate", restoreInvestment);
export default router;
