import express from "express";

import {
  addSale,
} from "../controllers/salesController.js";

const router =
  express.Router();

router.post(
  "/",
  addSale
);

export default router;