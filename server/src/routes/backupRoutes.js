import express from "express";

import {
  createBackup,
  listBackups,
} from "../controllers/backupController.js";

const router =
  express.Router();

router.get("/", listBackups);

router.post(
  "/",
  createBackup
);

export default router;