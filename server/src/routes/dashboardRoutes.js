import express from "express";

import {
  dashboardSummary,
} from "../controllers/dashboardController.js";

const router =
  express.Router();

router.get(
  "/summary",
  dashboardSummary
);

export default router;