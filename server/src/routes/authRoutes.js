import express from "express";

import {
  login,
  logout,
  getCurrentUser,
} from "../controllers/authController.js";

const router = express.Router();

router.post("/login", login);
router.post("/logout", logout);
router.get("/me", getCurrentUser);

export default router;