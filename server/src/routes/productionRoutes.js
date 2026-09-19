import express from "express";

import {
  calculateProduction,
  addProduction,
} from "../controllers/productionController.js";

const router =
  express.Router();

router.get(
  "/calculate",
  calculateProduction
);

router.post(
  "/",
  addProduction
);

export default router;