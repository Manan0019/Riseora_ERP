import express from "express";

import {
  requestResetOtp,
  confirmResetOtp,
} from "../controllers/passwordResetController.js";

const router = express.Router();

router.post(
  "/password-reset/request",
  requestResetOtp,
);

router.post(
  "/password-reset/confirm",
  confirmResetOtp,
);

export default router;
